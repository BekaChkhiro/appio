import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApiBaseUrl, getAppBaseUrl, getUserContentDomain } from "@appio/config";
import { SharePageClient } from "./share-page-client";

interface PublicApp {
  name: string;
  slug: string;
  description: string | null;
  url: string | null;
  theme_color: string | null;
  install_count: number;
}

async function getPublicApp(slug: string): Promise<PublicApp | null> {
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/api/v1/apps/public/${encodeURIComponent(slug)}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const app = await getPublicApp(slug);

  if (!app) {
    return { title: "App Not Found" };
  }

  const description =
    app.description ?? `${app.name} — a PWA built with Appio`;
  const appUrl = `https://${app.slug}.${getUserContentDomain()}`;
  const ogImageUrl = `${getAppBaseUrl()}/api/og?name=${encodeURIComponent(app.name)}&color=${encodeURIComponent(app.theme_color ?? "#7c3aed")}`;

  return {
    title: app.name,
    description,
    openGraph: {
      title: app.name,
      description,
      type: "website",
      url: appUrl,
      siteName: "Appio",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: app.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: app.name,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { slug } = await params;
  const app = await getPublicApp(slug);

  if (!app) {
    notFound();
  }

  return <SharePageClient app={app} />;
}
