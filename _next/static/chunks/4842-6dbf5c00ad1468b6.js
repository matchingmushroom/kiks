"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[4842],{24014:(e,t,s)=>{s.d(t,{$:()=>l});var r=s(4927),a=s(89674);async function l(e){let t=(0,r.doc)(a.db,"counters",e),s=await (0,r.getDoc)(t),l=1;return s.exists()&&(l=(s.data().lastNumber||0)+1),await (0,r.setDoc)(t,{lastNumber:l},{merge:!0}),`${e}-${String(l).padStart(4,"0")}`}},59074:(e,t,s)=>{s.d(t,{A:()=>o});var r=s(95155),a=s(12115),l=s(33210),n=s(89239),i=s(47266);function o({items:e,onClose:t}){let{settings:s}=(0,i.l)(),c=s.shopName||"Panchakanya Collections",m=s.website||"",[p,u]=(0,a.useState)("standard"),[h,x]=(0,a.useState)(()=>e.map(()=>!0)),[g,b]=(0,a.useState)(()=>e.map(e=>e.quantity)),[f,v]=(0,a.useState)(1),[y,w]=(0,a.useState)(1),j=e=>{u(e),v(1),w(1)},N="small"===p?{cols:4,rows:21,labelW:46,labelH:11,name:"ST-84",total:84}:{cols:4,rows:14,labelW:50,labelH:20,name:"ST-56",total:56},$=N.rows,k=N.cols,S=N.total,C=(e,t)=>{let s=[...g];s[e]=Math.max(0,t),b(s)},z=e.reduce((e,t,s)=>e+(h[s]?g[s]:0),0),A=(f-1)*k+y,M=S-A+1,D=Math.max(1,Math.ceil((z-M)/S)+ +(z>M)),P=Math.min(z,M),T=M-P,R=(0,a.useMemo)(()=>{let t=[];for(let s=0;s<e.length;s++)if(h[s])for(let r=0;r<g[s];r++)t.push({item:e[s],idx:s});return t},[e,h,g]),_=(0,a.useMemo)(()=>{let e=[],t=0;for(let s=1;s<=S;s++)if(s<A)e.push({type:"empty"});else if(t<R.length){let{item:s}=R[t];e.push({type:"filled",label:s.productName,sku:s.sku,price:s.price,shortCode:s.shortCode}),t++}else e.push({type:"unused"});return e},[A,R]);return(0,r.jsx)("div",{className:"fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4",onClick:t,children:(0,r.jsxs)("div",{className:"bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[95vh] overflow-y-auto",onClick:e=>e.stopPropagation(),children:[(0,r.jsxs)("div",{className:"flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10",children:[(0,r.jsx)("h2",{className:"text-base font-bold text-secondary",children:"Print Labels"}),(0,r.jsx)("button",{onClick:t,className:"p-1.5 hover:bg-muted rounded-lg",children:(0,r.jsx)(l.A,{className:"h-4 w-4"})})]}),(0,r.jsxs)("div",{className:"p-4 space-y-3",children:[(0,r.jsxs)("div",{className:"flex items-center gap-3",children:[(0,r.jsxs)("label",{className:"flex items-center gap-2 text-sm cursor-pointer",children:[(0,r.jsx)("input",{type:"radio",name:"tagFormat",value:"standard",checked:"standard"===p,onChange:()=>j("standard"),className:"accent-primary"}),"Standard (ST-56)"]}),(0,r.jsxs)("label",{className:"flex items-center gap-2 text-sm cursor-pointer",children:[(0,r.jsx)("input",{type:"radio",name:"tagFormat",value:"small",checked:"small"===p,onChange:()=>j("small"),className:"accent-primary"}),"Small Tag (ST-84)"]})]}),(0,r.jsxs)("div",{className:"flex items-center gap-3 px-1",children:[(0,r.jsx)("button",{onClick:()=>x(Array(e.length).fill(!0)),className:"text-xs text-primary hover:underline font-medium",children:"Select All"}),(0,r.jsx)("button",{onClick:()=>x(Array(e.length).fill(!1)),className:"text-xs text-muted-foreground hover:underline",children:"Deselect All"})]}),e.map((e,t)=>(0,r.jsxs)("div",{className:"flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/50",children:[(0,r.jsx)("input",{type:"checkbox",checked:h[t],onChange:()=>{let e;(e=[...h])[t]=!e[t],x(e)},className:"accent-primary h-4 w-4 shrink-0"}),(0,r.jsxs)("div",{className:"flex-1 min-w-0",children:[(0,r.jsx)("p",{className:"text-sm font-medium text-secondary truncate",children:e.productName}),(0,r.jsxs)("p",{className:"text-xs text-muted-foreground",children:["SKU: ",e.sku,e.shortCode?` \xb7 Short: ${e.shortCode}`:""," \xb7 ","MRP: Rs. ",e.price.toLocaleString("en-IN")]})]}),(0,r.jsxs)("div",{className:"flex items-center gap-2 shrink-0",children:[(0,r.jsx)("button",{onClick:()=>C(t,g[t]-1),className:"w-7 h-7 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted text-sm font-medium",children:"−"}),(0,r.jsx)("input",{type:"number",min:0,value:g[t],onChange:e=>C(t,parseInt(e.target.value)||0),className:"w-14 text-center text-sm border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"}),(0,r.jsx)("button",{onClick:()=>C(t,g[t]+1),className:"w-7 h-7 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted text-sm font-medium",children:"+"})]})]},t))]}),z>0&&(0,r.jsxs)("div",{className:"px-4 pb-4 space-y-3 border-t border-border pt-4",children:[(0,r.jsxs)("div",{className:"flex items-end gap-4",children:[(0,r.jsxs)("div",{children:[(0,r.jsx)("label",{className:"block text-xs font-medium text-muted-foreground mb-1",children:"Start Row"}),(0,r.jsx)("input",{type:"number",min:1,max:$,value:f,onChange:e=>{v(Math.min($,Math.max(1,Number(e.target.value)||1))),y>k&&w(k)},className:"w-16 px-2 py-1.5 border border-border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"})]}),(0,r.jsxs)("div",{children:[(0,r.jsx)("label",{className:"block text-xs font-medium text-muted-foreground mb-1",children:"Start Column"}),(0,r.jsx)("input",{type:"number",min:1,max:k,value:y,onChange:e=>w(Math.min(k,Math.max(1,Number(e.target.value)||1))),className:"w-16 px-2 py-1.5 border border-border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"})]}),(0,r.jsxs)("div",{className:"text-sm text-secondary font-semibold pb-1.5",children:["Position ",(0,r.jsx)("span",{className:"text-primary font-bold",children:A})," / ",S]})]}),(0,r.jsx)("div",{className:"grid gap-[1px] bg-border rounded border border-border overflow-hidden",style:{maxWidth:"330px",gridTemplateColumns:`repeat(${k}, 1fr)`},children:_.map((e,t)=>{let s=Math.floor(t/k)+1,a=t%k+1,l=t+1,n=l>=A;return(0,r.jsxs)("button",{onClick:()=>{v(s),w(a)},className:`
                      flex items-center justify-center text-[7px] font-mono transition-colors
                      ${!n?"bg-white text-transparent pointer-events-none":""}
                      ${"filled"===e.type?"bg-primary/10 text-primary font-bold":""}
                      ${"unused"===e.type?"bg-white text-muted-foreground/40 border border-dashed border-muted-foreground/20 m-[1px]":""}
                      ${"empty"===e.type?"":"cursor-pointer hover:bg-primary/5"}
                    `,style:{aspectRatio:`${N.labelW}/${N.labelH}`},title:`Row ${s}, Col ${a} (Pos ${l})`,children:[n&&"unused"===e.type?l:"","filled"===e.type?e.label&&e.label.length>5?e.label.substring(0,5)+"…":e.label:""]},t)})}),(0,r.jsxs)("div",{className:"text-xs text-muted-foreground space-y-0.5 bg-slate-50 p-3 rounded-lg",children:[(0,r.jsxs)("p",{children:["Starting at ",(0,r.jsxs)("strong",{className:"text-secondary",children:["position ",A]})," — filling ",(0,r.jsx)("strong",{className:"text-secondary",children:P})," of ",(0,r.jsx)("strong",{className:"text-secondary",children:M})," slots on this sheet."]}),T>0&&(0,r.jsxs)("p",{children:[(0,r.jsx)("strong",{className:"text-amber-600",children:T})," slot",1!==T?"s":""," will remain unused on this sheet."]}),(0,r.jsxs)("p",{children:["Total: ",(0,r.jsx)("strong",{className:"text-secondary",children:z})," label",1!==z?"s":""," on ",(0,r.jsx)("strong",{className:"text-secondary",children:D})," sheet",1!==D?"s":"","."]}),(0,r.jsxs)("p",{className:"text-[10px] text-muted-foreground mt-1",children:[N.name," template (",N.labelW,"mm \xd7 ",N.labelH,"mm, ",N.total," per sheet)"]})]})]}),(0,r.jsxs)("div",{className:"p-4 border-t border-border flex items-center justify-between",children:[(0,r.jsxs)("span",{className:"text-sm text-muted-foreground",children:[z," label",1!==z?"s":""," selected"]}),(0,r.jsx)(n.$,{onClick:()=>{let e=window.open("","_blank");if(!e)return void alert("Pop-up blocked. Allow pop-ups and try again.");let t=0,s=[],r=!0;for(;t<R.length;){let e=[];for(let s=1;s<=S;s++)if(r&&s<A)e.push('<div class="label-cell empty"></div>');else if(t<R.length){let{item:s}=R[t];"small"===p?e.push(`
              <div class="label-cell small">
                <div class="st-shortcode">${d(s.shortCode||s.sku)}</div>
                <div class="st-name">${d(s.productName)}</div>
                <div class="st-mrp">Rs. ${s.price.toLocaleString("en-IN")}</div>
              </div>
            `):e.push(`
              <div class="label-cell">
                <div class="pl-shop-name">${d(c)}</div>
                ${s.shortCode?`<div class="pl-shortcode">${d(s.shortCode)}</div>`:""}
                <div class="pl-name">${d(s.productName)}</div>
                <svg class="pl-barcode" data-barcode="${d(s.barcodeId||s.sku)}"></svg>
                <div class="pl-sku">${d(s.sku)}</div>
                <div class="pl-mrp">MRP: Rs. ${s.price.toLocaleString("en-IN")}</div>
                ${m?`<div class="pl-website">${d(m)}</div>`:""}
              </div>
            `),t++}else e.push('<div class="label-cell empty"></div>');s.push(`<div class="a4-page"><div class="label-grid">${e.join("")}</div></div>`),r=!1}0===s.length&&s.push(`<div class="a4-page"><div class="label-grid">${Array.from({length:S},()=>'<div class="label-cell empty"></div>').join("")}</div></div>`);let a=`
      .label-grid { display: grid; gap: 0; grid-template-columns: repeat(${k}, 50mm); grid-template-rows: repeat(${$}, 20mm); width: 210mm; justify-content: center; align-content: start; padding: 8.5mm 5mm; }
      .label-cell { width: 50mm; height: 20mm; box-sizing: border-box; padding: 0.5mm 1mm; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
      .pl-shop-name { font-size: 4px; font-weight: 600; text-align: center; color: #888; line-height: 1; }
      .pl-shortcode { font-size: 6px; font-weight: 800; text-align: center; color: #222; letter-spacing: 0.5px; }
      .pl-name { font-size: 6px; font-weight: 700; text-align: center; line-height: 1.1; max-height: 12px; overflow: hidden; width: 100%; white-space: nowrap; text-overflow: ellipsis; }
      .pl-barcode { max-width: 46mm; height: 7mm; margin: 0; }
      .pl-sku { font-size: 4px; color: #555; text-align: center; letter-spacing: 0.3px; }
      .pl-mrp { font-size: 7px; font-weight: 700; text-align: center; }
      .pl-website { font-size: 3.5px; font-weight: 400; text-align: center; color: #888; line-height: 1; }
    `,l=`
      .label-grid { display: grid; gap: 0; grid-template-columns: repeat(${k}, 46mm); grid-template-rows: repeat(${$}, 11mm); width: 210mm; justify-content: center; align-content: start; padding: 8.5mm 13mm; }
      .label-cell { width: 46mm; height: 11mm; box-sizing: border-box; padding: 0.3mm 0.5mm; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
      .label-cell.small { gap: 0; }
      .st-shortcode { font-size: 14px; font-weight: 800; text-align: center; line-height: 1.1; letter-spacing: 0.3px; }
      .st-name { font-size: 4px; font-weight: 600; text-align: center; color: #555; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 44mm; }
      .st-mrp { font-size: 6px; font-weight: 700; text-align: center; }
    `,n="small"===p?"":`
      <script>
        document.querySelectorAll('.pl-barcode').forEach(function(el) {
          try {
            JsBarcode(el, el.getAttribute('data-barcode'), { format: "CODE128", width: 0.8, height: 18, displayValue: false, margin: 0, background: "#ffffff" });
          } catch(e) { console.warn(e); }
        });
        setTimeout(function() { window.print(); }, 500);
      </script>
    `;e.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Price Labels</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4 portrait; margin: 0; }
          body { width: 210mm; margin: 0; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; }
          .a4-page { width: 210mm; height: 297mm; page-break-after: always; overflow: hidden; }
          .label-cell.empty { visibility: hidden; }
          @media print { @page { size: A4 portrait; margin: 0; } body { background: #fff; } }
          ${"small"===p?l:a}
        </style>
      </head>
      <body>
        ${s.join("")}
        ${n}
      </body>
      </html>
    `),e.document.close()},disabled:0===z,variant:"accent",children:"Print Selected"})]})]})})}function d(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}},67467:(e,t,s)=>{s.d(t,{Bv:()=>l,Sn:()=>n,ZZ:()=>d,gS:()=>i,n0:()=>o});var r=s(4927),a=s(89674);async function l(){let e=(0,r.doc)(a.db,"counters","sku_base36"),t=await (0,r.getDoc)(e),s=(t.exists()?t.data().lastNumber:0)+1;return await (0,r.setDoc)(e,{lastNumber:s},{merge:!0}),s.toString(36).toUpperCase().padStart(5,"0")}async function n(e){let t=(0,r.doc)(a.db,"counters",`modelCode_${e}`),s=await (0,r.getDoc)(t),l=(s.exists()?s.data().lastNumber:0)+1;return await (0,r.setDoc)(t,{lastNumber:l},{merge:!0}),`${e}-${String(l).padStart(3,"0")}`}async function i(e){let t=(0,r.query)((0,r.collection)(a.db,"products"),(0,r.where)("categoryId","==",e)),s=await (0,r.getDocs)(t),l=new Set;return s.docs.forEach(e=>{let t=e.data().modelCode;t&&"string"==typeof t&&l.add(t)}),Array.from(l).sort()}async function o(e){let t=(0,r.doc)(a.db,"counters",`barcode_${e}`),s=await (0,r.getDoc)(t),l=(s.exists()?s.data().lastNumber:0)+1;return await (0,r.setDoc)(t,{lastNumber:l},{merge:!0}),`${e}-${String(l).padStart(4,"0")}`}function d(e,t,s,r){let a=String(Math.floor(t/10)+10).padStart(5,"0");return`${e}-${a}-${s}${r}`}}}]);