import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import Image from "next/image";

const templates = [
  {
    "id": "poster",
    "title": "Poster",
    "description": "Make a statement with a striking poster."
  },
  {
    "id": "interior_design",
    "title": "Interior design",
    "description": "Explore a new look for your space."
  },
  {
    "id": "logo",
    "title": "Logo",
    "description": "Give your brand a distinctive identity."
  },
  {
    "id": "illustration",
    "title": "Illustration",
    "description": "Bring a story or idea to life."
  },
  {
    "id": "headshot",
    "title": "Headshot",
    "description": "Create a polished portrait from your photo."
  },
  {
    "id": "icon",
    "title": "Icon",
    "description": "Explore a cohesive set of visual symbols."
  },
  {
    "id": "product_photo",
    "title": "Product photo",
    "description": "Showcase your product in the right setting."
  },
  {
    "id": "merch",
    "title": "Merch",
    "description": "Picture your design on everyday products."
  },
  {
    "id": "infographic",
    "title": "Infographic",
    "description": "Turn information into a clear visual story."
  },
  {
    "id": "flyer",
    "title": "Flyer",
    "description": "Spread the word about your next event."
  },
  {
    "id": "book_cover",
    "title": "Book cover",
    "description": "Set the tone for your next story."
  },
  {
    "id": "app_mockup",
    "title": "App mockup",
    "description": "Visualize an interface for your app idea."
  },
  {
    "id": "packaging",
    "title": "Packaging",
    "description": "Explore how your product could be packaged."
  },
  {
    "id": "advertisement",
    "title": "Advertisement",
    "description": "Create a campaign image that stands out."
  },
  {
    "id": "thumbnail",
    "title": "Thumbnail",
    "description": "Give your next video an eye-catching cover."
  },
  {
    "id": "website_mockup",
    "title": "Website mockup",
    "description": "Explore a visual direction for your website."
  }
];

export function TemplateGallery({ onSelect }: { onSelect?: (id: string) => void }) {
  const root = useRef<HTMLElement>(null);
  const viewed = useRef(new Set<string>());
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.templateId;
        if (entry.isIntersecting && id && !viewed.current.has(id)) { viewed.current.add(id); trackEvent("template_view", { template_id: id }); }
      }
    }, { threshold: 0.5 });
    root.current?.querySelectorAll("[data-template-id]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  return (
    <section ref={root} aria-labelledby="templates-heading" className="px-4 pb-12 md:px-8 md:pb-16">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6">
          <h2 id="templates-heading" className="font-display text-3xl font-medium text-foreground">Templates</h2>
          <p className="mt-2 text-sm text-muted-foreground">A little inspiration for your next image.</p>
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {templates.map((template) => (
            <li data-template-id={template.id} key={template.id} className="min-w-0">
              <button type="button" onClick={() => onSelect?.(template.id)} aria-label={`Use ${template.title} template`} className="relative block aspect-[4/5] w-full overflow-hidden rounded-ui-xl bg-surface-soft transition-all duration-300 hover:shadow-soft active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <Image
                  src={`/templates/covers/${template.id}-v1.png`}
                  alt={`${template.title} example`}
                  fill
                  sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1535px) 25vw, 320px"
                  className="object-cover"
                />
              </button>
              <h3 className="mt-3 text-sm font-medium text-foreground sm:text-base">{template.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{template.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
