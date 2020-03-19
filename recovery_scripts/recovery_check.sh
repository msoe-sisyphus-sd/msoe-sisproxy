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
	ps aux | grep " server.js" | grep -v grep
	nodepids=$(ps aux | grep " server.js" | grep -v grep | cut -c10-15)
	
	# echo "OK, so we will stop these process/es now..."
	for nodepid in ${nodepids[@]}
	do
	echo "Stopping PID :"$nodepid >> restart.log
	kill -9 $nodepid
	done

	# remove log folder
	#cd /var/log/
	#rm -rf sisyphus

	# remove status
	cd /home/pi/sisbot-server/sisbot/content/
	rm status.json

	# reset rc.local
	#echo -e "#!/bin/sh -e\ncd /home/pi/sisbot-server/sisproxy && git reset --hard && NODE_ENV=sisbot node server.js &\nexit 0\n" > /etc/rc.local

}

################################################################################
resetup_sis_software(){

	# reset hostname
	cd /home/pi/sisbot-server/sisbot
	./set_hostname.sh Sisyphus


}

################################################################################
sisyphus_recovery_procedure(){

	echo "RECOVEY IN PROCESS"

	# Kill all running processes
	shutdown_sis_software

	# Remove the current directories
	rm -rf /home/pi/sisbot-server/sisbot
	rm -rf /home/pi/sisbot-server/siscloud
	rm -rf /home/pi/sisbot-server/sisproxy
	
	# Untar the recoery files 
	cd /home/pi/sis_recovery/protected_backup
	tar xf recovery.tar.gz

	# Copy the recovery copies into place
	cp -rp /home/pi/sis_recovery/protected_backup/recovery/sisbot /home/pi/sisbot-server/sisbot
	cp -rp /home/pi/sis_recovery/protected_backup/recovery/siscloud /home/pi/sisbot-server/siscloud
	cp -rp /home/pi/sis_recovery/protected_backup/recovery/sisproxy /home/pi/sisbot-server/sisproxy

	# Remove the recovery source
	rm -rf /home/pi/sis_recovery/protected_backup/recovery

	# Re-setup software
	resetup_sis_software

	# Stop the LED flash
	kill $pid_flash	
        sleep 0.25
        echo $GPIO_OFF > /sys/class/gpio/gpio$GPIO_LED_RED/value       

	#Setup the interfaces file for hostspot mode
	cp /etc/network/interfaces.hotspot /etc/network/interfaces

	#Set the green LED
	echo $GPIO_ON > /sys/class/gpio/gpio$GPIO_LED_GRN/value

	echo "RECOVERY COMPLETE"
	sleep 10

	#Clear the gleen LED
	echo $GPIO_OFF > /sys/class/gpio/gpio$GPIO_LED_GRN/value

	# Reboot the Pi to restart the software
	reboot
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
