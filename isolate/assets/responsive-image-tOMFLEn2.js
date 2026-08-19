import{r as a,j as e}from"./framer-motion-C9bEhpGk.js";import{c as l}from"./index-Bh1zq-YJ.js";import{I as N}from"./image-BwzG2S3E.js";function C({src:t,alt:c,className:m,containerClassName:u,placeholder:o,aspectRatio:g="aspect-video",objectFit:f="object-cover",loading:h="lazy",showShimmer:p=!0,fallbackIcon:b,onLoad:i,onError:n,sizes:x,draggable:k=!1,decoding:y="async"}){const[s,r]=a.useState("loading"),j=a.useRef(null),v=a.useCallback(()=>{r("loaded"),i?.()},[i]),E=a.useCallback(()=>{r("error"),n?.()},[n]);return e.jsxs("div",{className:l("relative overflow-hidden bg-muted",g,u),children:[p&&s==="loading"&&e.jsx("div",{className:"absolute inset-0 shimmer-bg",children:o&&e.jsx("div",{className:"absolute inset-0 blur-xl scale-110",style:{background:o}})}),s==="error"&&e.jsxs("div",{className:"absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/50 text-muted-foreground",children:[b||e.jsx(N,{className:"w-8 h-8 opacity-40"}),e.jsx("span",{className:"text-xs opacity-60",children:"Failed to load image"})]}),s!=="error"&&e.jsx("img",{ref:j,src:t,alt:c,draggable:k,decoding:y,loading:h,sizes:x,onLoad:v,onError:E,className:l(f,"w-full h-full transition-opacity duration-500",s==="loaded"?"opacity-100":"opacity-0",m)})]})}const d="responsive-image-shimmer";function S(){if(typeof document>"u"||document.getElementById(d))return;const t=document.createElement("style");t.id=d,t.textContent=`
    .shimmer-bg {
      background: linear-gradient(
        110deg,
        oklch(0.93 0.01 145) 30%,
        oklch(0.96 0.005 145) 50%,
        oklch(0.93 0.01 145) 70%
      );
      background-size: 200% 100%;
      animation: shimmer-slide 1.5s ease-in-out infinite;
    }
    .dark .shimmer-bg {
      background: linear-gradient(
        110deg,
        oklch(0.22 0.02 155) 30%,
        oklch(0.25 0.015 155) 50%,
        oklch(0.22 0.02 155) 70%
      );
      background-size: 200% 100%;
    }
    @keyframes shimmer-slide {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `,document.head.appendChild(t)}typeof window<"u"&&S();export{C as R};
