FROM node:8-alpine

ENV NODE_ENV production

RUN apk add --update build-base git python2-dev && \
  rm -rf /tmp/* /var/cache/apk/*


COPY ./*.json /opt/kaltura/api-gw/

WORKDIR /opt/kaltura/api-gw
RUN npm install

COPY ./*.js /opt/kaltura/api-gw/
COPY ./lib /opt/kaltura/api-gw/lib/
COPY ./config /opt/kaltura/api-gw/config/


EXPOSE 80
EXPOSE 443

ENTRYPOINT ["node"]
CMD ["start"]