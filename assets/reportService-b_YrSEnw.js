import{p as b}from"./index-CtbbSWdW.js";const i=e=>"₹"+(e||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}),o=e=>(e||0).toLocaleString("en-IN"),g="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",T="Consolas,'Courier New',monospace",a="padding:8px 10px;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.4px;text-align:left;",l=a+"text-align:right;",n="padding:8px 10px;border-bottom:1px solid #eef2f7;font-size:13px;color:#334155;text-align:left;",s=n+`text-align:right;font-family:${T};`,I=(e,r)=>{const m=new Date().toUTCString(),x=r.config,R=r.variances.slice(0,10),E=r.ewb_only.filter(t=>t.reason.startsWith("Not reported")).slice(0,10),G=r.gstr_only.filter(t=>t.reason.startsWith("EWB likely")).slice(0,10),c=t=>`<h2 style="font-size:17px;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:26px 0 12px;font-family:${g};">${t}</h2>`,$=(t,d,p="#4338ca")=>`
    <td width="50%" style="padding:6px;vertical-align:top;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <tr><td style="padding:12px 14px;font-family:${g};">
          <div style="font-size:19px;font-weight:700;color:${p};font-family:${T};">${t}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">${d}</div>
        </td></tr>
      </table>
    </td>`,w=t=>{let d="";for(let p=0;p<t.length;p+=2)d+=`<tr>${t[p]||'<td width="50%"></td>'}${t[p+1]||'<td width="50%"></td>'}</tr>`;return`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${d}</table>`},u=(t,d,p,N,D,O)=>`
    <td width="50%" style="padding:6px;vertical-align:top;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${O};border:1px solid #e2e8f0;border-radius:10px;">
        <tr><td style="padding:12px 14px;font-family:${g};">
          <div style="font-size:11px;font-weight:700;color:${D};text-transform:uppercase;letter-spacing:.4px;">${t}</div>
          <div style="font-size:13px;color:#334155;margin-top:5px;">${d}</div>
          <div style="font-size:13px;color:#64748b;margin-top:2px;">${p}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:5px;">${N}</div>
        </td></tr>
      </table>
    </td>`,h=t=>`<span style="display:inline-block;background:#eef2ff;color:#4338ca;border-radius:20px;padding:3px 11px;font-size:11px;margin:2px;font-family:${g};">${t}</span>`,f=(t,d)=>`<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:8px;">${t}${d}</table>`,y=(t,d)=>`<tr><td colspan="${t}" style="${n}text-align:center;color:#94a3b8;padding:14px;">${d}</td></tr>`,k=e.perPeriod.map(t=>`
    <tr>
      <td style="${n}">${b(t.period)}</td>
      <td style="${s}">${o(t.gstrDocs)}</td>
      <td style="${s}">${o(t.ewbDocs)}</td>
      <td style="${s}">${o(t.matched)}</td>
      <td style="${s}">${o(t.variances)}</td>
      <td style="${s}">${o(t.gstrOnly)}</td>
      <td style="${s}">${o(t.ewbOnly)}</td>
      <td style="${s}">${i(t.taxAtRisk)}</td>
    </tr>`).join("")||y(8,"No periods"),S=R.map(t=>`
    <tr>
      <td style="${n}">${t.doc_no}</td><td style="${n}">${t.buyer_gstin}</td><td style="${n}">${t.remarks}</td>
      <td style="${s}">${i(t.assessable_var)}</td>
      <td style="${s}">${i(t.total_tax_var)}</td>
    </tr>`).join("")||y(5,"No variances 🎉"),W=E.map(t=>`
    <tr>
      <td style="${n}">${t.doc_no}</td><td style="${n}">${t.other_party_gstin||"—"}</td>
      <td style="${s}">${i(t.assessable)}</td><td style="${s}">${i(t.total_tax)}</td>
    </tr>`).join("")||y(4,"None"),B=G.map(t=>`
    <tr>
      <td style="${n}">${t.doc_no}</td><td style="${n}">${t.buyer_gstin}</td>
      <td style="${s}">${i(t.invoice_value)}</td><td style="${s}">${i(t.assessable)}</td>
    </tr>`).join("")||y(4,"None"),C=t=>t==="High"?"#b91c1c":t==="Medium"?"#b45309":"#64748b",z=r.action_register.slice(0,15).map(t=>`
    <tr>
      <td style="${n}"><span style="font-weight:700;color:${C(t.priority)};">${t.priority}</span></td>
      <td style="${n}">${t.type}</td>
      <td style="${n}">${t.doc_no}</td>
      <td style="${n}">${t.party}</td>
      <td style="${s}">${i(t.amount)}</td>
      <td style="${n}">${t.action}</td>
    </tr>`).join("")||y(6,"✓ Nothing needs action — no genuine mismatches after timing, FOC and exclusions."),v=(t,d,p)=>`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-top:10px;">
      <tr><td style="padding:14px 16px;font-family:${g};">
        <div style="font-size:15px;font-weight:700;color:#b45309;margin-bottom:6px;">${t}. ${d}</div>
        <div style="font-size:13px;line-height:1.6;color:#334155;">${p}</div>
      </td></tr>
    </table>`;return`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EWB vs GSTR-1 Reconciliation Report</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;}
  table{mso-table-lspace:0;mso-table-rspace:0;}
</style></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:${g};color:#334155;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">
  <tr><td align="center" style="padding:20px 12px;">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">

      <!-- Header -->
      <tr><td style="background:#4338ca;padding:26px 30px;font-family:${g};">
        <div style="font-size:23px;font-weight:700;color:#ffffff;">E-Way Bill vs GSTR-1 Reconciliation</div>
        <div style="font-size:12px;color:#ffffff;opacity:.85;margin-top:4px;">Generated ${m}</div>
      </td></tr>

      <tr><td style="padding:20px 30px 28px;font-family:${g};">

        ${c("📅 Period Coverage")}
        ${w([u("GSTR-1 JSON",`Return period: <strong>${e.gstrFps.map(b).join(", ")||"—"}</strong>`,`Invoice dates: ${e.gstrDateRange||"—"}`,`${e.gstrFiles} file(s) · ${o(e.uniqueGstrDocs)} docs`,"#4338ca","#eef2ff"),u("E-Way Bill Excel",`Period(s): <strong>${e.ewbPeriods.map(b).join(", ")||"—"}</strong>`,`Doc dates: ${e.ewbDateRange||"—"}`,`${e.ewbFiles} file(s) · ${o(e.validEwbRows)} valid rows`,"#15803d","#f0fdf4")])}

        ${e.ewbFileLikelyIncomplete?`
        <div style="margin:14px 0;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
          <div style="font-weight:700;color:#991b1b;font-size:13px;">⚠️ E-Way Bill file looks incomplete — read before acting</div>
          <div style="font-size:12px;color:#b91c1c;line-height:1.5;margin-top:4px;">
            ${o(e.gstrMissingEwbCount)} taxable goods invoices (${i(e.gstrOnlyMissingEwbValue)} assessable)
            have no matching e-way bill — only ${Math.round(e.ewbCoverageRatio*100)}% of EWB-requiring invoices matched.
            This usually means the EWB export did not cover the full period. Re-export the complete e-way bill list
            (all sub-users) for the exact return period and re-run before treating the figure below as a compliance gap.
          </div>
        </div>`:""}
        ${e.missingGstrPeriods.length?`
        <div style="margin:14px 0;padding:12px 14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;">
          <div style="font-weight:700;color:#78350f;font-size:13px;">➕ Add a GSTR-1 to resolve timing differences</div>
          <ul style="font-size:12px;color:#92400e;line-height:1.5;margin:4px 0 0;padding-left:18px;">
            ${e.missingGstrPeriods.map(t=>`<li><strong>${b(t.period)}</strong> — ${o(t.ewbTimingCount)} e-way bill doc(s) worth ${i(t.ewbTimingValue)} fall in this month, but its GSTR-1 was not uploaded. Add ${b(t.period)} GSTR-1 and re-run to confirm they were reported.</li>`).join("")}
          </ul>
        </div>`:""}
        ${e.ewbOnlyTimingCount?`
        <div style="margin:14px 0;padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:12px;color:#1e40af;line-height:1.5;">
          <strong>${o(e.ewbOnlyTimingCount)}</strong> EWB-only document(s) worth
          <strong>${i(e.ewbOnlyTimingValue)}</strong> are timing items (invoice dated in a month whose GSTR-1
          was not uploaded) and are excluded from the “EWB-only tax exposure” below — they are reported in that month’s own GSTR-1.
        </div>`:""}

        ${c("💰 Money at a Glance")}
        ${w([$(i(e.totalTaxAtRisk),"Tax at risk (matched variances)","#b91c1c"),$(i(e.ewbOnlyTaxExposure),"EWB-only tax exposure (genuine, ex-timing)","#b91c1c"),$(i(e.gstrOnlyMissingEwbValue),"GSTR value likely needing an EWB","#4338ca"),$(o(e.completelyMatched),"Documents matched clean","#15803d")])}

        ${c("★ Action Register — what to actually do")}
        ${f(`<tr><th style="${a}">Priority</th><th style="${a}">Action needed</th><th style="${a}">Doc No</th><th style="${a}">Party / Period</th><th style="${l}">Amount</th><th style="${a}">What to do</th></tr>`,z)}
        ${r.action_register.length>15?`<div style="font-size:11px;color:#94a3b8;margin-top:4px;">Showing top 15 of ${o(r.action_register.length)} — full list in the Excel “Action_Register” sheet.</div>`:""}

        ${c("📊 Counts")}
        ${w([$(o(e.docsInBoth),"In both sources"),$(o(e.withVariance),"With variance","#b45309"),$(o(e.onlyInEwb),"Only in EWB","#b91c1c"),$(o(e.onlyInGstr),"Only in GSTR-1","#b91c1c")])}
        <div style="margin-top:10px;">
          ${h(`Timing diffs: ${o(e.timingDifferenceCount)}`)}
          ${h(`Tax-type mismatches: ${o(e.taxTypeMismatchCount)}`)}
          ${h(`GSTIN mismatches: ${o(e.gstinMismatchCount)}`)}
          ${h(`Cancelled EWB: ${o(e.cancelledEwbRows)}`)}
          ${h(`Delivery challans: ${o(e.deliveryChallanRows)}`)}
        </div>

        ${c("Period-wise Position")}
        ${f(`<tr><th style="${a}">Period</th><th style="${l}">GSTR docs</th><th style="${l}">EWB docs</th><th style="${l}">Matched</th><th style="${l}">Variances</th><th style="${l}">GSTR only</th><th style="${l}">EWB only</th><th style="${l}">Tax at risk</th></tr>`,k)}

        ${c("Top Variances (by value at risk)")}
        ${f(`<tr><th style="${a}">Doc No</th><th style="${a}">Buyer GSTIN</th><th style="${a}">Nature</th><th style="${l}">Assessable Δ</th><th style="${l}">Tax Δ</th></tr>`,S)}

        ${c("Top EWB-only — possible under-reporting in GSTR-1")}
        ${f(`<tr><th style="${a}">Doc No</th><th style="${a}">Other party GSTIN</th><th style="${l}">Assessable</th><th style="${l}">Tax</th></tr>`,W)}

        ${c("Top GSTR-only — EWB likely required but not found")}
        ${f(`<tr><th style="${a}">Doc No</th><th style="${a}">Buyer GSTIN</th><th style="${l}">Invoice value</th><th style="${l}">Assessable</th></tr>`,B)}

        ${c("Recommended Actions")}
        ${v("1","Close the variances",`Work the <strong>Variances</strong> sheet top-down (pre-sorted by money at risk: ${i(e.totalTaxAtRisk)} of tax). Fix tax-type (IGST vs CGST+SGST) and GSTIN mismatches first — they often signal wrong place-of-supply.`)}
        ${v("2","Investigate EWB-only documents",`${o(e.onlyInEwb)} EWBs (${i(e.ewbOnlyTaxExposure)} tax) have no matching GSTR-1 entry. Confirm these supplies are reported — unreported outward supplies are an under-reporting exposure. Timing items clear once the later period's GSTR-1 is filed.`)}
        ${v("3","Check GSTR-only above threshold",`${o(r.gstr_only.filter(t=>t.reason.startsWith("EWB likely")).length)} invoices above the ₹${o(x.ewbThreshold)} EWB threshold have no E-Way Bill. Verify an EWB was generated (non-generation carries penalty under Rule 138).`)}

        ${r.warnings.length?`${c("Data-quality notes")}<ul style="font-size:12px;color:#64748b;line-height:1.6;padding-left:20px;">${r.warnings.map(t=>`<li>${t}</li>`).join("")}</ul>`:""}

      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f8fafc;padding:16px;text-align:center;font-size:11px;color:#94a3b8;font-family:${g};">
        Generated by gst-ewb-recon &middot; Tolerances: assessable ₹${o(x.assessableTolerance)}, tax ₹${o(x.taxTolerance)}/head &middot; Match ${x.matchAcrossPeriods?"across periods":"period-locked"}
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`};export{I as generateHtmlReport};
