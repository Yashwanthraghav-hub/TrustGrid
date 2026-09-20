import Link from "next/link";
import {Logo} from "@/components/ui/core";
export default function NotFound(){return <main id="main" className="auth-wrap"><section className="panel auth-card"><Logo/><h1>This page is not available.</h1><p>The link may be incorrect, or the record may not be available to this workspace.</p><Link className="button primary" href="/dashboard">Return to workspace</Link><Link className="text-link" href="/">Go to the home page</Link></section></main>}
