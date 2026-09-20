"use client";
import {createContext,useCallback,useContext,useEffect,useState,useSyncExternalStore} from "react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import en from "@/lib/i18n/en.json";
import ta from "@/lib/i18n/ta.json";
type Language="en"|"ta";
type PreferencesValue={language:Language;theme:string;setLanguage:(value:Language)=>void;setTheme:(value:string)=>void;t:(key:string)=>string};
const Preferences=createContext<PreferencesValue>({language:"en",theme:"light",setLanguage:()=>{},setTheme:()=>{},t:key=>key});
export function usePreferences(){return useContext(Preferences)}
function subscribe(callback:()=>void){window.addEventListener('storage',callback);window.addEventListener('trustgrid-preference',callback);return()=>{window.removeEventListener('storage',callback);window.removeEventListener('trustgrid-preference',callback)}}
function snapshot(){return `${localStorage.getItem('trustgrid-language')||'en'}|${localStorage.getItem('trustgrid-theme')||'light'}`}
export function Providers({children}:{children:React.ReactNode}){
 const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{staleTime:15000,retry:1,refetchOnWindowFocus:true}}}));
 const preferences=useSyncExternalStore(subscribe,snapshot,()=>"en|light");const [storedLanguage,storedTheme]=preferences.split('|');const language:Language=storedLanguage==='ta'?'ta':'en';const theme=storedTheme==='dark'?'dark':'light';
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.lang=language},[theme,language]);
 const setLanguage=useCallback((v:Language)=>{localStorage.setItem('trustgrid-language',v);window.dispatchEvent(new Event('trustgrid-preference'))},[]);
 const setTheme=useCallback((v:string)=>{localStorage.setItem('trustgrid-theme',v);window.dispatchEvent(new Event('trustgrid-preference'))},[]);
 const dict=(language==='ta'?ta:en) as Record<string,string>;
 return <QueryClientProvider client={client}><Preferences.Provider value={{language,theme,setLanguage,setTheme,t:(key)=>dict[key]||key.replaceAll('_',' ')}}>{children}</Preferences.Provider></QueryClientProvider>
}
