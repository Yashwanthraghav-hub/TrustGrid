import {PublicHeader,PublicFooter} from "@/components/layout/public";
import {DemoSimulator} from "@/components/allocations/demo";
export default function Demo(){return <><PublicHeader/><div className="simulation-bar"><strong>DEMO DATA</strong> · Fictional areas and editable local calculations. No real requests, stock, people, or notifications.</div><main id="main" className="public-main" style={{paddingTop:40}}><DemoSimulator/><PublicFooter/></main></>}
