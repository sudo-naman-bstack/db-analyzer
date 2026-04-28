export const JIRA_FIELDS = {
  promisedEta: "customfield_10110",
  customerExpectedEta: "customfield_17291",
  baselineArr: "customfield_10693",
  incrementalAcv: "customfield_10694",
  ceName: "customfield_10746",
  dbCategory: "customfield_11081",
  dbProduct: "customfield_10493",
  sfdcLink: "customfield_10204",
  customerStage: "customfield_10147",
} as const;

export const ISSUE_FIELDS_TO_REQUEST: string[] = [
  "summary",
  "status",
  "assignee",
  "created",
  "updated",
  "description",
  ...Object.values(JIRA_FIELDS),
];
