import * as studioModel from './model';
import type { ComponentProps, ReactNode } from 'react';
import { Icon } from '../shared/Brand';
import { type Asset } from './types';

export function Action({ action, className = 'is-button', ...props }: ComponentProps<'button'> & { action: string }) {
  return <button type="button" className={className} data-studio-action={action} {...props} />;
}

export function Menu({ children, title = 'More actions' }: { children: ReactNode; title?: string }) {
  return <details className="is-menu"><summary className="is-button" aria-label={title}>
    {title === 'More actions' ? <Icon name="more" /> : <>{title}<Icon name="chevron" /></>}
  </summary><div className="is-menu-list">{children}</div></details>;
}

export function ErrorMessage({ message }: { message: string }) {
  return message ? <p className="is-error" role="alert"><Icon name="help" /><span>{message}</span></p> : null;
}

export function styleLabel(key: string) {
  return studioModel.styles.find(style => style[0] === key)?.[1] || key || 'Natural';
}

export function fileMeta(asset: Asset) {
  return `${asset.width || '—'} × ${asset.height || '—'} · ${studioModel.filename(asset).split('.').pop()?.toUpperCase() || 'PNG'}`;
}

export function AssetActions({ asset }: { asset: Asset }) {
  return <>
    <Action action="copy" className="is-menu-item" data-id={asset.id}><Icon name="file" /> Copy image</Action>
    <Action action="save" className="is-menu-item" data-id={asset.id}><Icon name="folder" /> Save to Knowledge Hub</Action>
    <Action action="analyze-asset" className="is-menu-item" data-id={asset.id}><Icon name="eye" /> Analyze image</Action>
    <Action action="reuse" className="is-menu-item" data-id={asset.id}><Icon name="history" /> Reuse settings</Action>
    <Action action="details" className="is-menu-item" data-id={asset.id}><Icon name="sliders" /> Image details</Action>
  </>;
}
