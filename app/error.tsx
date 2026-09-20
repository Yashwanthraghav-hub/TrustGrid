"use client";
import {Notice} from "@/components/ui/core";
export default function ErrorPage({reset}:{reset:()=>void}){return <main id="main" className="auth-wrap"><section className="panel auth-card"><h1>We could not load this page.</h1><Notice tone="error">The request did not complete. Refreshing does not imply that a previous operation succeeded.</Notice><button className="primary" style={{marginTop:24}} onClick={reset}>Try again</button></section></main>}
