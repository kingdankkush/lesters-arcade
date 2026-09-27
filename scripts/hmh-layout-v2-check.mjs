// Prints the layout v2 checker report (design package section 2.9).
//   node scripts/hmh-layout-v2-check.mjs
import { LAYOUT_V2_MAP } from '../apps/hmh-reboot/src/layout-v2-map.mjs';
import { checkLayoutV2, formatLayoutV2Report } from '../apps/hmh-reboot/src/layout-v2-checker.mjs';

const report = checkLayoutV2(LAYOUT_V2_MAP);
console.log(formatLayoutV2Report(report, LAYOUT_V2_MAP));
process.exitCode = report.ok ? 0 : 1;
