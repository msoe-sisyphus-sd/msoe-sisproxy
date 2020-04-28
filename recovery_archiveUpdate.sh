#!/usr/bin/env bash

# create sis_recovery if not there
if [ ! -d "/home/pi/sis_recovery" ]; then
  echo "sis_recovery does not exist" >> /var/log/sisyphus/recovery.log
  mkdir -p /home/pi/sis_recovery
  cp -r /home/pi/sisbot-server/sisproxy/recovery_scripts /home/pi/sis_recovery/scripts
  sudo chown -R pi:pi /home/pi/sis_recovery

  # update startup check
  cd /etc/init.d
  sudo ln -s /home/pi/sis_recovery/scripts/recovery_check.sh sis_recovery_check
  sudo update-rc.d -f sis_recovery_check defaults
else
  echo "update sis_recovery" >> /var/log/sisyphus/recovery.log
  cp /home/pi/sisbot-server/sisproxy/recovery_scripts/recovery_check.sh /home/pi/sis_recovery/scripts/
fi

echo "update archive" >> /var/log/sisyphus/recovery.log

# create directories to be archived
mkdir -p /home/pi/sis_recovery/protected_backup/recovery

# copy sisbot
cp -rp /home/pi/sisbot-server/sisbot /home/pi/sis_recovery/protected_backup/recovery/sisbot
cd /home/pi/sis_recovery/protected_backup/recovery/sisbot
git reset --hard
# TODO: add specific git commit value

# copy siscloud
cp -rp /home/pi/sisbot-server/siscloud /home/pi/sis_recovery/protected_backup/recovery/siscloud
cd /home/pi/sis_recovery/protected_backup/recovery/siscloud
git reset --hard
# TODO: add specific git commit value

# copy sisproxy
cp -rp /home/pi/sisbot-server/sisproxy /home/pi/sis_recovery/protected_backup/recovery/sisproxy
cd /home/pi/sis_recovery/protected_backup/recovery/sisproxy
git reset --hard
# TODO: add specific git commit value

# move to recovery folder
cd /home/pi/sis_recovery/protected_backup

# delete old archive
if [ -f "recovery.tar.gz" ]; then
  echo "Remove old archive" >> /var/log/sisyphus/recovery.log
  sudo rm recovery.tar.gz
fi

# create new archive
echo "Make new archive" >> /var/log/sisyphus/recovery.log
cd /home/pi/sis_recovery/protected_backup/recovery/
sudo tar cvzf recovery.tar.gz ./* > /dev/null
mv recovery.tar.gz /home/pi/sis_recovery/protected_backup

cd /home/pi

# protect archive
echo "Archive Permissions" >> /var/log/sisyphus/recovery.log
sudo chmod 400 /home/pi/sis_recovery/protected_backup/recovery.tar.gz

# cleanup
sudo rm -rf /home/pi/sis_recovery/protected_backup/recovery

echo "Archive refreshed" >> /var/log/sisyphus/recovery.log
