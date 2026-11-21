from mongoengine import connect
from mongoengine.connection import get_connection

MONGODB_URI = "mongodb://ev_admin:evpass1234@ac-jhecocl-shard-00-00.u596shs.mongodb.net:27017,ac-jhecocl-shard-00-01.u596shs.mongodb.net:27017,ac-jhecocl-shard-00-02.u596shs.mongodb.net:27017/?ssl=true&replicaSet=atlas-l0sjwg-shard-0&authSource=admin"

def main():
    connect(host=MONGODB_URI, alias="default")
    conn = get_connection(alias="default")
    conn.admin.command("ping")
    print("Ping OK: MongoDB is reachable")

if __name__ == "__main__":
    main()