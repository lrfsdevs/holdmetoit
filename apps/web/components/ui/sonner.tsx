"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
   return (
      <Sonner
         theme="dark"
         position="bottom-right"
         offset={{ bottom: 88, right: 16 }}
         mobileOffset={{ bottom: 88, right: 16 }}
         richColors
         {...props}
      />
   );
}
