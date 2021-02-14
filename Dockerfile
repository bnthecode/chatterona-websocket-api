FROM node:13
WORKDIR /home/node/server
ADD server /home/node/server
RUN npm install
CMD npm start

