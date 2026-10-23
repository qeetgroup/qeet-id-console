import type { TFunction } from "i18next";

import { OPERATOR_LABELS } from "../../api/abac";
import type { PolicyProblem } from "../../utils/policy-codegen";

/** Returns why a policy can't be saved, in the reader's language. */
export function policyProblemMessage(problem: PolicyProblem, t: TFunction): string {
  const operator = "op" in problem ? t(OPERATOR_LABELS[problem.op]) : "";
  return t(`rbac:conditionProblem.${problem.code}`, { operator });
}
