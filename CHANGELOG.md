# 2019-07-1 1.4.19
 - check for networking files on startup
 - Ansible reconnect updates maintain_conn
 # 2019-03-17 1.4.18 5c6c747dfc8bc0603e3b95d5b5dbf0355da470ab
 - update sis_recovery backup file if needed
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
