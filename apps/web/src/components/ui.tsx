import React from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';

export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 py-10 sm:py-14">
      <span className="text-xs font-bold uppercase tracking-wider text-aegis-accent">{eyebrow}</span>
      <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">{title}</h2>
      {description && <div className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{description}</div>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 rounded-2xl border border-aegis-border bg-aegis-card p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
};

export function Button({ variant = 'primary', loading, disabled, className = '', children, ...rest }: ButtonProps) {
  const base =
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-gradient-to-r from-aegis-accent to-aegis-blue text-white hover:opacity-90'
      : 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700';
  return (
    <button type="button" disabled={disabled || loading} className={`${base} ${styles} ${className}`} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return (
    <input
      className={`min-h-[44px] w-full min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-500 focus:border-aegis-accent focus:outline-none ${className}`}
      {...rest}
    />
  );
}

export function ExtLink({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1 break-all text-aegis-accent hover:underline ${className}`}
    >
      {children}
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  );
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

export function SuccessBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

export function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/50 p-3 text-xs leading-relaxed text-slate-400">
      {children}
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function Stat({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 break-words text-sm text-slate-100 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

export function Badge({ tone = 'slate', children }: { tone?: 'slate' | 'green' | 'amber' | 'blue'; children: React.ReactNode }) {
  const tones = {
    slate: 'border-slate-600 bg-slate-800 text-slate-300',
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    blue: 'border-aegis-accent/30 bg-aegis-accent/10 text-aegis-accent',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
