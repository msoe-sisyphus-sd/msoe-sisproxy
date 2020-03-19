#!/bin/bash

GPIO_RESET_SW=2
GPIO_LED_RED=3
GPIO_LED_GRN=4

################################################################################
gpio_release(){
        echo $GPIO_RESET_SW > /sys/class/gpio/unexport
        echo $GPIO_LED_RED > /sys/class/gpio/unexport
        echo $GPIO_LED_GRN  > /sys/class/gpio/unexport

        echo "GPIO SETUP RELEASED"
}


gpio_release

