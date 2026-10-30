function supabaseImagePatterns() {
   const patterns = [
      {
         protocol: "https",
         hostname: "*.supabase.co",
         pathname: "/**",
      },
      {
         protocol: "https",
         hostname: "*.supabase.in",
         pathname: "/**",
      },
      {
         protocol: "https",
         hostname: "*.supabase.net",
         pathname: "/**",
      },
   ];

   const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
   if (!raw) return patterns;
   try {
      const { protocol, hostname } = new URL(raw);
      if (!patterns.some((p) => p.hostname === hostname)) {
         patterns.push({
            protocol: protocol.replace(":", ""),
            hostname,
            pathname: "/storage/v1/object/public/**",
         });
      }
      return patterns;
   } catch {
      return patterns;
   }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
   reactStrictMode: true,
   eslint: {
      dirs: ["app", "components", "core", "features", "lib", "types"],
   },
   experimental: {
      serverActions: {
         // 3 MB punishment image + multipart overhead (Vercel caps requests at 4.5 MB).
         bodySizeLimit: "4mb",
      },
      // Ship the changelog source with the serverless function so the dynamic
      // /changelog route can read it at runtime.
      outputFileTracingIncludes: {
         "/changelog": ["../../CHANGELOG.md"],
      },
      // discord.js ships undici/ws-backed runtime code; keep it out of the
      // server bundle and resolve it from node_modules instead.
      serverComponentsExternalPackages: ["@holdmetoit/discord", "discord.js"],
   },
   /**
    * Returns permanent mappings from legacy URLs to the current application routes.
    */
   async redirects() {
      return [
         {
            source: "/dashboard",
            destination: "/",
            permanent: true,
         },
         {
            source: "/challenge",
            destination: "/challenges",
            permanent: true,
         },
         {
            source: "/challenges/new",
            destination: "/admin/challenges/new",
            permanent: true,
         },
         {
            source: "/challenges/:id/:path*",
            destination: "/challenge/:id/:path*",
            permanent: true,
         },
         {
            source: "/challenges/:id",
            destination: "/challenge/:id",
            permanent: true,
         },
         {
            source: "/pokedex",
            destination: "/pokemon",
            permanent: true,
         },
         {
            source: "/pokedex/:path*",
            destination: "/pokemon/:path*",
            permanent: true,
         },
         {
            source: "/leaderboards",
            destination: "/leaderboard",
            permanent: true,
         },
         {
            source: "/wallets",
            destination: "/wallet",
            permanent: true,
         },
         {
            source: "/pokemons",
            destination: "/pokemon",
            permanent: true,
         },
         {
            source: "/changelogs",
            destination: "/changelog",
            permanent: true,
         },
      ];
   },
   images: {
      remotePatterns: [
         {
            protocol: "https",
            hostname: "cdn.discordapp.com",
            pathname: "/**",
         },
         {
            protocol: "https",
            hostname: "images.unsplash.com",
            pathname: "/**",
         },
         {
            protocol: "https",
            hostname: "raw.githubusercontent.com",
            pathname: "/**",
         },
         ...supabaseImagePatterns(),
      ],
   },
};

export default nextConfig;
