import i18n from "@/i18n";
import { OPERATOR_LABELS } from "@/modules/authorization/api/abac";
import type { PolicyProblem } from "@/modules/authorization/utils/policy-codegen";

/** Returns why a policy can't be saved, in the reader's language. */
export function policyProblemMessage(problem: PolicyProblem): string {
  const operator = "op" in problem ? i18n.t(OPERATOR_LABELS[problem.op]) : "";
  return i18n.t(`authorization:conditionProblem.${problem.code}`, { operator });
}
