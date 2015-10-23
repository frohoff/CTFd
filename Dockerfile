FROM ubuntu:trusty

ADD . /opt/CTFd

RUN apt-get update && apt-get upgrade -y && apt-get install git -y
RUN cd /opt/CTFd/ && ./prepare.sh

WORKDIR /opt/CTFd/

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "-w", "4", "CTFd:create_app()"]

EXPOSE 8000
