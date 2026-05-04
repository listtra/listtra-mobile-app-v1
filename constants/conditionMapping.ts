export const conditionMapping: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  lightly_used: "Lightly Used",
  well_used: "Well Used",
  heavily_used: "Heavily Used",
};

export const formatCondition = (condition: string): string => {
  if (!condition) return "";
  return conditionMapping[condition] || condition;
}; 