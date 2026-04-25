"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { Card, CardContent, Badge, Button } from "@appio/ui";
import { Wand2, Users } from "lucide-react";
import type { AppTemplate } from "@appio/api-client";

interface TemplateCardProps {
  template: AppTemplate;
  index: number;
}

export function TemplateCard({ template, index }: TemplateCardProps) {
  const hasScreenshot =
    template.preview_screenshots && template.preview_screenshots.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="group relative flex h-full flex-col overflow-hidden transition-colors hover:border-primary/30">
        {/* Preview screenshot or icon placeholder */}
        {hasScreenshot ? (
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
            <Image
              src={template.preview_screenshots![0]}
              alt={`${template.name} preview`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform group-hover:scale-[1.02]"
            />
          </div>
        ) : (
          <div className="flex aspect-[16/10] w-full items-center justify-center bg-muted/50">
            <span
              className="text-4xl"
              role="img"
              aria-label={`${template.name} icon`}
            >
              {template.icon}
            </span>
          </div>
        )}

        <CardContent className="flex flex-1 flex-col p-4">
          {/* Category badge */}
          <Badge variant="secondary" className="w-fit text-[11px]">
            {template.category}
          </Badge>

          {/* Name + Description */}
          <h3 className="mt-2 font-semibold text-sm">{template.name}</h3>
          <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
            {template.description}
          </p>

          {/* Footer: use count + CTA */}
          <div className="mt-4 flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {template.use_count.toLocaleString()} uses
            </span>
            <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
              <Link href={`/build?template=${template.slug}`}>
                <Wand2 className="h-3.5 w-3.5" />
                Customize
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
