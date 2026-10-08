import type { Express, NextFunction, Request, Response } from 'express';
import { generators, Issuer, type Client } from 'openid-client';
import { z } from 'zod';
import { config } from './config.js';
import { hashPassword, verifyPassword } from './crypto.js';
import type { Role, User } from './models.js';
import { repository } from './repository.js';

declare module 'express-session' {
  interface SessionData {
    user?: User;
    oidcState?: string;
    oidcNonce?: string;
  }
}

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(50),
  password: z.string().min(1, 'Password is required').max(100)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').max(100)
});

export async function configureAuth(app: Express) {
  let client: Client | undefined;
  if (config.authMode === 'entra') {
    const issuer = await Issuer.discover(`https://login.microsoftonline.com/${config.entra.tenantId}/v2.0/.well-known/openid-configuration`);
    client = new issuer.Client({
      client_id: config.entra.clientId,
      client_secret: config.entra.clientSecret,
      redirect_uris: [config.entra.redirectUri],
      response_types: ['code']
    });
  }

  const handleLogin = async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: { code: 'invalid_request', message: parsed.error.issues[0]?.message || 'Invalid username or password.' }
        });
      }
      const { username, password } = parsed.data;
      const userWithSecret = await repository.findUserByUsername(username);
      if (!userWithSecret || !userWithSecret.passwordHash || !userWithSecret.salt) {
        return res.status(401).json({
          error: { code: 'invalid_credentials', message: 'Invalid username or password.' }
        });
      }

      const isValid = await verifyPassword(password, userWithSecret.passwordHash, userWithSecret.salt);
      if (!isValid) {
        return res.status(401).json({
          error: { code: 'invalid_credentials', message: 'Invalid username or password.' }
        });
      }

      const sessionUser: User = {
        id: userWithSecret.id,
        username: userWithSecret.username,
        displayName: userWithSecret.displayName,
        email: userWithSecret.email,
        role: userWithSecret.role,
        mustChangePassword: userWithSecret.mustChangePassword,
        tenantId: userWithSecret.tenantId,
        objectId: userWithSecret.objectId
      };

      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => (err ? reject(err) : resolve()));
      });
      req.session.user = sessionUser;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });

      return res.json({ status: 'ok', user: sessionUser });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: { code: 'internal_error', message: 'An error occurred during authentication.' } });
    }
  };

  app.post('/api/auth/login', handleLogin);
  app.post('/auth/login', handleLogin);

  const handleLogout = (req: Request, res: Response, next: NextFunction) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie('cloudcore.sid');
      if (req.header('accept')?.includes('application/json') || req.path.startsWith('/api')) {
        return res.json({ status: 'ok' });
      }
      return res.redirect('/');
    });
  };

  app.post('/api/auth/logout', handleLogout);
  app.post('/auth/logout', handleLogout);

  app.post('/api/auth/change-password', requireUser, async (req: Request, res: Response) => {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: { code: 'invalid_request', message: parsed.error.issues[0]?.message || 'Invalid password parameters.' }
        });
      }
      const { currentPassword, newPassword } = parsed.data;
      if (currentPassword === newPassword) {
        return res.status(400).json({
          error: { code: 'same_password', message: 'New password cannot be identical to current password.' }
        });
      }

      const currentUser = await repository.findUserById(req.session.user!.id);
      if (!currentUser || !currentUser.passwordHash || !currentUser.salt) {
        return res.status(404).json({ error: { code: 'user_not_found', message: 'User record not found.' } });
      }

      const matches = await verifyPassword(currentPassword, currentUser.passwordHash, currentUser.salt);
      if (!matches) {
        return res.status(400).json({
          error: { code: 'incorrect_password', message: 'Current password is not correct.' }
        });
      }

      const hashed = await hashPassword(newPassword);
      await repository.updateUserPassword(currentUser.id, hashed.hash, hashed.salt, false);

      req.session.user!.mustChangePassword = false;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });

      return res.json({ status: 'ok', message: 'Password updated successfully.' });
    } catch (error) {
      console.error('Password change error:', error);
      return res.status(500).json({ error: { code: 'internal_error', message: 'Failed to update password.' } });
    }
  });

  if (config.authMode === 'entra' && client) {
    app.get('/auth/login', (req, res) => {
      const state = generators.state(), nonce = generators.nonce();
      req.session.oidcState = state;
      req.session.oidcNonce = nonce;
      res.redirect(client!.authorizationUrl({ scope: 'openid profile email', state, nonce }));
    });

    app.get('/auth/callback', async (req, res, next) => {
      try {
        if (!client) throw new Error('Entra authentication is not configured.');
        const params = client.callbackParams(req);
        const oidcState = req.session.oidcState, oidcNonce = req.session.oidcNonce;
        const tokens = await client.callback(config.entra.redirectUri, params, { state: oidcState, nonce: oidcNonce });
        const claims = tokens.claims();
        const objectId = String(claims.oid ?? claims.sub);
        const role = config.entra.adminObjectIds.has(objectId) ? 'admin' : 'user';
        const user = await repository.upsertUser({
          tenantId: String(claims.tid ?? config.entra.tenantId),
          objectId,
          username: String(claims.preferred_username ?? claims.email ?? objectId),
          email: String(claims.preferred_username ?? claims.email ?? ''),
          displayName: String(claims.name ?? claims.preferred_username ?? 'CloudCore user'),
          role
        });
        await new Promise<void>((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
        req.session.user = user;
        await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
        res.redirect('/#home');
      } catch (error) {
        next(error);
      }
    });
  }
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({
      error: { code: 'authentication_required', message: 'Sign in to use CloudCore AI.' }
    });
  }
  res.locals.user = req.session.user;
  next();
}

export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user) {
      return res.status(401).json({
        error: { code: 'authentication_required', message: 'Sign in to use CloudCore AI.' }
      });
    }
    const role = req.session.user.role;
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        error: { code: 'forbidden', message: 'You do not have permission to perform this action.' }
      });
    }
    next();
  };
}
