import * as gg from "@/lib/grantsgov";
(async () => {
  for (const arg of process.argv.slice(2)) {
    const [keyword, cats = ""] = arg.split(":");
    const { result } = await gg.search({ keyword, oppStatuses: "forecasted|posted", eligibilities: gg.ELIGIBILITY.nonprofit501c3, fundingCategories: cats, rows: 50 });
    console.log(`\n## ${keyword} [${cats}] hits=${result.hitCount}`);
    for (const h of result.oppHits) if (!/NIH|Clinical Trial|K\d\d|R\d\d|T3\d|P\d0/.test(h.agencyCode + h.title)) console.log(`${h.id} | ${h.oppStatus} | close ${h.closeDate || "-"} | ${h.agencyCode} | ${h.title.slice(0, 100)}`);
  }
})();
