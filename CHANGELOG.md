# 2019-12-17 1.4.13
 - Send error response if ansible method fails

# 2019-09-04 1.4.12
 - Fix moving of proxy.log on restart which prevents crashes on extra long proxy.log files

# 2019-05-28 1.4.10
  - Revert reset no longer deletes status.json file
  - .gitignore added package-lock.json

# 2019-04-17 1.4.7
  - don't let the mystery death message kill all the bots on the LAN
  - if in DEV mode, do not revert_reset and delete all code changes
