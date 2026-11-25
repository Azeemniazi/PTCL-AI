import { type ComponentProps, type ReactNode } from 'react';
import { Icon } from '../shared/Brand';

export function SettingsHeading({ icon, title, description, children }: {
  icon: ComponentProps<typeof Icon>['name']; title: string; description: string; children?: ReactNode;
}) {
  return <div className="panel-heading"><span className="feature-icon"><Icon name={icon} /></span>
    <div><h2>{title}</h2><p>{description}</p></div>{children}</div>;
}

export function SettingsField({ label, ...input }: ComponentProps<'input'> & { label: string }) {
  return <label><span>{label}</span><input {...input} /></label>;
}

export function SettingsError({ message }: { message: string }) {
  return message ? <div className="login-alert" role="alert" style={{ marginBottom: 12 }}>{message}</div> : null;
}
