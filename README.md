soil moisture code used to configure the the different hardware for the different farms intending to use our system.


##########################################################################################################################
#include <SoftwareSerial.h> // SIM card module

// Initialize SIM card module serial communication
SoftwareSerial gprsSerial(A13, A12);

// Sensor pins
#define sensorPower 7
#define sensorPin A0

void setup() {
  pinMode(sensorPower, OUTPUT);
  digitalWrite(sensorPower, LOW); // Initially keep the sensor OFF
  
  Serial.begin(9600);     // Initialize serial communication
  gprsSerial.begin(9600); // Initialize SIM card module serial communication
  delay(1000);
}

void loop() {
  int soilMoisture = readSensor(); // Get soil moisture value
  Serial.print("Analog output: ");
  Serial.println(soilMoisture);
  
  thingsSpeakConn(soilMoisture); // Send data to ThingSpeak
  delay(15000); // Wait 15 seconds before sending again
}

// Function to read soil moisture sensor
int readSensor() {
  digitalWrite(sensorPower, HIGH); // Turn the sensor ON
  delay(10); // Allow power to settle
  int val = analogRead(sensorPin); // Read the analog value from sensor
  digitalWrite(sensorPower, LOW); // Turn the sensor OFF
  return val; // Return analog moisture value
}

void thingsSpeakConn(int moisture) {
  gprsSerial.println("AT");
  delay(1000);
  gprsSerial.println("AT+CPIN?");
  delay(1000);
  gprsSerial.println("AT+CREG?");
  delay(1000);
  gprsSerial.println("AT+CGATT?");
  delay(1000);
  gprsSerial.println("AT+CIPSHUT");
  delay(1000);
  gprsSerial.println("AT+CIPMUX=0");
  delay(2000);
  gprsSerial.println("AT+CSTT=\"yellopix.mtn.co.ug\"");
  delay(1000);
  gprsSerial.println("AT+CIICR");
  delay(3000);
  gprsSerial.println("AT+CIFSR");
  delay(2000);
  gprsSerial.println("AT+CIPSTART=\"TCP\",\"api.thingspeak.com\",\"80\"");
  delay(6000);
  gprsSerial.println("AT+CIPSEND");
  delay(4000);

  String str = "GET https://api.thingspeak.com/update?api_key=O1JIB4V8QIOQ01QN&field1=" + String(moisture); //field number changes according to the user's ID
  Serial.println(str);
  gprsSerial.println(str);
  delay(4000);
  gprsSerial.println((char)26);
  delay(5000);
  gprsSerial.println("AT+CIPSHUT");
  delay(100);
}

#################################################################################################################################
