const replaceVariables = (template, data) => {
  if (!template) return "";

  let result = template;

  Object.keys(data).forEach((key) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    result = result.replace(regex, data[key] ?? "");
  });

  return result;
};

module.exports = replaceVariables;
