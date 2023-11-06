# Dockerization to run the applications

We have Dockerfile configured to install the dependencies, compile the api documentation and start the application. Run the following commands to start the application.

- Build the Docker Image

    `$ docker build -t msspbevm .`

- Start the Docker Container

    `$ docker run --name MSSP-VM-BACKEND -d -p 7081:7081 -e "PM2_ENVIRONMENT=staging -e "ENCRYPTION_KEY=Encryption_Key_String" -e "IV=IV_String" msspbevm`

    The application will start in the environment mentioned in `PM2_ENVIRONMENT` variable

    It is mandatory to pass `ENCRYPTION_KEY` and `IV` parameters as they are required for decrypting the configuration variables

- To check the application, Run the following url in browser
 
    `http://<IP Address>:7081/api/v1/<router>`

- To check the apidoc, Run the following url in browser

    `http://<IP Address>:7081/api/v1/docs`
    
