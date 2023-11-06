FROM node:10.16.3

# Create app directory
RUN mkdir -p /opt/mssp-be-vm
WORKDIR /opt/mssp-be-vm

# Include package.json changes
ADD package.json /opt/mssp-be-vm/

# Install dependencies
RUN npm install
RUN npm install pm2 -g
RUN npm install apidoc -g

# Bundle app source
COPY . /opt/mssp-be-vm/

# Create api documentation
RUN apidoc -i routes/ -o doc/

# Configuring port
EXPOSE 7081

# Command to start app using pm2
CMD ["sh", "-c", "ENCRYPTION_KEY=$ENCRYPTION_KEY IV=$IV pm2-docker start app.json --env $PM2_ENVIRONMENT"]
