import type {Metadata} from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./globals.css";
import {Providers} from "@/components/ui/providers";
export const metadata:Metadata={title:{default:"TrustGrid · Help reach the right place",template:"%s · TrustGrid"},description:"From crisis noise to coordinated action. Community reports, reviewed needs, accountable handoffs.",icons:{icon:"/brand/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body><a className="skip-link" href="#main">Skip to content</a><Providers>{children}</Providers></body></html>}
