const ActivityLog = require("../models/ActivityLog");

const logActivity = async ({
  user,
  action,
  module,
  referenceId,
  description,
}) => {
  await ActivityLog.create({
    user,
    action,
    module,
    referenceId,
    description,
  });
};

module.exports = logActivity;
