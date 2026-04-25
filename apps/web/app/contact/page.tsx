import { Github, Linkedin, Mail, MapPin } from "lucide-react";
import { PageIntro, SiteFrame } from "../_components/site-frame";
import { profile } from "../site-data";

export default function ContactPage() {
  return (
    <SiteFrame>
      <PageIntro
        eyebrow="Contact"
        title="Let's talk about backend, cloud, and AI systems."
        body="The fastest way to reach me is email. I am most interested in production backend work, GCP infrastructure, reliability, and practical AI engineering."
      />

      <section className="mx-auto grid max-w-6xl gap-6 px-5 pb-16 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="rounded-2xl border border-white/10 bg-slate-900/85 p-5">
          <div className="space-y-4">
            <a href={`mailto:${profile.email}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950 p-4 text-slate-200 hover:border-sky-300/40">
              <Mail className="text-sky-300" size={20} aria-hidden="true" />
              {profile.email}
            </a>
            <a href={profile.github} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950 p-4 text-slate-200 hover:border-sky-300/40">
              <Github className="text-sky-300" size={20} aria-hidden="true" />
              github.com/bpajor
            </a>
            <a href={profile.linkedin} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950 p-4 text-slate-200 hover:border-sky-300/40">
              <Linkedin className="text-sky-300" size={20} aria-hidden="true" />
              LinkedIn profile
            </a>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950 p-4 text-slate-400">
              <MapPin className="text-emerald-300" size={20} aria-hidden="true" />
              {profile.location}
            </div>
          </div>
        </aside>

        <form action={`mailto:${profile.email}`} method="post" encType="text/plain" className="rounded-2xl border border-white/10 bg-slate-900/85 p-5 md:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-300">
              Name
              <input name="name" required className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none ring-sky-300/30 focus:border-sky-300/50 focus:ring-4" />
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              Email
              <input name="email" type="email" required className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none ring-sky-300/30 focus:border-sky-300/50 focus:ring-4" />
            </label>
          </div>
          <label className="mt-4 grid gap-2 text-sm text-slate-300">
            Message
            <textarea name="message" required rows={8} className="resize-none rounded-md border border-white/10 bg-slate-950 px-3 py-3 text-slate-100 outline-none ring-sky-300/30 focus:border-sky-300/50 focus:ring-4" />
          </label>
          <button type="submit" className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-sky-300 px-5 text-sm font-semibold text-slate-950 hover:bg-sky-200">
            <Mail size={17} aria-hidden="true" />
            Send message
          </button>
        </form>
      </section>
    </SiteFrame>
  );
}
