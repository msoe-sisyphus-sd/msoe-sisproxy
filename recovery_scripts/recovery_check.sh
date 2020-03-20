#!/bin/bash
#set -o verbose

GPIO_RESET_SW=2
GPIO_LED_RED=3
GPIO_LED_GRN=4

GPIO_ON=0
GPIO_OFF=1

################################################################################
gpio_setup(){

	# Setup the GPIO PINS
	echo $GPIO_RESET_SW > /sys/class/gpio/export
	echo $GPIO_LED_RED > /sys/class/gpio/export
	echo $GPIO_LED_GRN  > /sys/class/gpio/export

	# Set the Pin Directions
	echo in > /sys/class/gpio/gpio$GPIO_RESET_SW/direction
	echo out > /sys/class/gpio/gpio$GPIO_LED_RED/direction
	echo out > /sys/class/gpio/gpio$GPIO_LED_GRN/direction

  # Set the pin values. Both LEDs off.
  echo $GPIO_OFF > /sys/class/gpio/gpio$GPIO_LED_RED/value
  echo $GPIO_OFF > /sys/class/gpio/gpio$GPIO_LED_GRN/value

	echo "GPIO SETUP COMPLETE"
}

################################################################################
gpio_release(){
  echo $GPIO_RESET_SW > /sys/class/gpio/unexport
  echo $GPIO_LED_RED > /sys/class/gpio/unexport
  echo $GPIO_LED_GRN  > /sys/class/gpio/unexport

	echo "GPIO SETUP RELEASED"
}

################################################################################
check_for_reset_request(){

	return_val=1

	# Check if the Reset switch is pressed
	if [ `cat /sys/class/gpio/gpio2/value` -eq 0 ]
  then
		return_val=0
	fi

	return $return_val
}


################################################################################
shutdown_sis_software(){

	# kill running node processes
	echo "Kill node processes" >> /var/log/sisyphus/recovery.log
	ps aux | grep " server.js" | grep -v grep
	nodepids=$(ps aux | grep " server.js" | grep -v grep | cut -c10-15)

	# echo "OK, so we will stop these process/es now..."
	for nodepid in ${nodepids[@]}
	do
		echo "Stopping PID :"$nodepid >> /var/log/sisyphus/recovery.log
		kill -9 $nodepid
	done

	# remove log folder
	#cd /var/log/
	#rm -rf sisyphus

	# remove status
	# cd /home/pi/sisbot-server/sisbot/content/
	# rm status.json

	# reset rc.local
	#echo -e "#!/bin/sh -e\ncd /home/pi/sisbot-server/sisproxy && git reset --hard && NODE_ENV=sisbot node server.js &\nexit 0\n" > /etc/rc.local

}

################################################################################
resetup_sis_software(){

	# reset hostname
	echo "Reset hostname" >> /var/log/sisyphus/recovery.log
	cd /home/pi/sisbot-server/sisbot
	./set_hostname.sh Sisyphus

}

################################################################################
sisyphus_recovery_procedure(){

	now=$(date +"%T")
	echo "RECOVERY IN PROCESS: $now" >> /var/log/sisyphus/recovery.log

	# Kill all running processes
	shutdown_sis_software

	# Remove the current directories
	echo "Remove current directories" >> /var/log/sisyphus/recovery.log
	rm -rf /home/pi/sisbot-server/sisbot
	rm -rf /home/pi/sisbot-server/siscloud
	rm -rf /home/pi/sisbot-server/sisproxy

	# Untar the recovery files
	echo "Untar recovery files" >> /var/log/sisyphus/recovery.log
	cd /home/pi/sis_recovery/protected_backup
	tar xf recovery.tar.gz -C /home/pi/sisbot-server/

	# Copy the recovery copies into place
	# echo "Restore sisbot" >> /var/log/sisyphus/recovery.log
	# sudo mv /home/pi/sis_recovery/protected_backup/recovery/sisbot /home/pi/sisbot-server/ || echo "Sisbot mv error" >> /var/log/sisyphus/recovery.log
	# echo "Restore siscloud" >> /var/log/sisyphus/recovery.log
	# sudo mv /home/pi/sis_recovery/protected_backup/recovery/siscloud /home/pi/sisbot-server/ || echo "Siscloud mv error" >> /var/log/sisyphus/recovery.log
	# echo "Restore sisproxy" >> /var/log/sisyphus/recovery.log
 	# sudo mv /home/pi/sis_recovery/protected_backup/recovery/sisproxy /home/pi/sisbot-server/ || echo "Sisproxy mv error" >> /var/log/sisyphus/recovery.log

	# Remove the status file
	rm /home/pi/sisbot-server/sisbot/content/status.json

	# Remove the recovery source
	echo "Remove recovery" >> /var/log/sisyphus/recovery.log
	rm -rf /home/pi/sis_recovery/protected_backup/recovery

	# Stop the LED flash
	kill $pid_flash
  sleep 0.25
  echo $GPIO_OFF > /sys/class/gpio/gpio$GPIO_LED_RED/value

	#Setup the interfaces file for hostspot mode
	echo "Reset network interfaces" >> /var/log/sisyphus/recovery.log
	cp /etc/network/interfaces.hotspot /etc/network/interfaces

	#Set the green LED
	echo $GPIO_ON > /sys/class/gpio/gpio$GPIO_LED_GRN/value

	# Reset Table name
	resetup_sis_software

	echo "RECOVERY COMPLETE" >> /var/log/sisyphus/recovery.log
	sleep 10

	#Clear the gleen LED
	echo $GPIO_OFF > /sys/class/gpio/gpio$GPIO_LED_GRN/value

	# Reboot the Pi to restart the software
	echo "Reboot..." >> /var/log/sisyphus/recovery.log
	sudo reboot
}


################################################################################
################################################################################

set -o verbose

#Setup the GPIO resources
gpio_setup

#check for the reset request
check_for_reset_request
if [ $? -eq 0 ]
then
	# Begin the LED flash to indicate recovery in process
	/home/pi/sis_recovery/scripts/flash.sh & pid_flash=$!

	# Kick off recovery procedure
  sisyphus_recovery_procedure

	# Stop the LED flashing
	kill $pid_flash

fi


#Release the GPIO resources
#gpio_release
