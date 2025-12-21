const ActivityLog = require("../models/ActivityLog");

const logActivity = async ({
  userId,
  action,
  module,
  referenceId,
  description,
}) => {
  await ActivityLog.create({
    userId,
    action,
    module,
    referenceId,
    description,
  });
};

module.exports = logActivity;
