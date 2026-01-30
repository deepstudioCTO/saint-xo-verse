import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("music", "routes/music.tsx"),
  route("motion", "routes/motion.tsx"),
  route("generate", "routes/generate.tsx"),
  route("gallery", "routes/gallery.tsx"),
  route("result/:id", "routes/result.$id.tsx"),
  route("test", "routes/test.tsx"),
  route("api/generate", "routes/api.generate.tsx"),
  route("api/download", "routes/api.download.tsx"),
  route("api/upload-motion", "routes/api.upload-motion.tsx"),
  route("api/delete-motion", "routes/api.delete-motion.tsx"),
  route("api/delete-generation", "routes/api.delete-generation.tsx"),
  route("api/upscale", "routes/api.upscale.tsx"),
] satisfies RouteConfig;
