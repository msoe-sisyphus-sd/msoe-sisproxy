#!/usr/bin/env bash

# create sis_recovery if not there
if [ ! -d "/home/pi/sis_recovery" ]; then
  echo "sis_recovery does not exist"
  mkdir -p /home/pi/sis_recovery
  cp -r /home/pi/sisbot-server/sisproxy/recovery_scripts /home/pi/sis_recovery/scripts
  sudo chown -R pi:pi /home/pi/sis_recovery

  # update startup check
  cd /etc/init.d
  sudo ln -s /home/pi/sis_recovery/scripts/recovery_check.sh sis_recovery_check
  sudo update-rc.d -f sis_recovery_check defaults
fi

echo "update archive"

# create directories to be archived
mkdir -p /home/pi/sis_recovery/protected_backup/recovery

# copy sisbot
cp -rp /home/pi/sisbot-server/sisbot /home/pi/sis_recovery/protected_backup/recovery/sisbot
cd /home/pi/sis_recovery/protected_backup/recovery/sisbot
git reset --hard ecea860a2156b8b91524045584aecd1fa0b7f3dc

# copy siscloud
cp -rp /home/pi/sisbot-server/siscloud /home/pi/sis_recovery/protected_backup/recovery/siscloud
cd /home/pi/sis_recovery/protected_backup/recovery/siscloud
git reset --hard e1da68217ebdb8fa0610bdc797c7eb3e40b28345

# copy sisproxy
cp -rp /home/pi/sisbot-server/sisproxy /home/pi/sis_recovery/protected_backup/recovery/sisproxy
cd /home/pi/sis_recovery/protected_backup/recovery/sisproxy
git reset --hard

# move to recovery folder
cd /home/pi/sis_recovery/protected_backup

# delete old archive
if [ -f "recovery.tar.gz" ]; then
  echo "Remove old archive"
  sudo rm recovery.tar.gz
fi

# create new archive
echo "Make new archive"
sudo tar cvzf recovery.tar.gz recovery > /dev/null

cd /home/pi

# protect archive
echo "Archive Permissions"
sudo chmod 400 /home/pi/sis_recovery/protected_backup/recovery.tar.gz

# cleanup
sudo rm -rf /home/pi/sis_recovery/protected_backup/recovery

echo "Archive refreshed"
