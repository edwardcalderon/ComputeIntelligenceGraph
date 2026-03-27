import sqlite3
import logging
from datetime import datetime
from neo4j import GraphDatabase
from .config import config

logger = logging.getLogger(__name__)

# Schema mapping: Map ERP entities to dummy infrastructure
INFRA_MAP = {
    "vendedores": {"type": "Service", "provider": "aws", "infra": "EC2", "region": "us-east-1"},
    "campanas": {"type": "Marketing", "provider": "aws", "infra": "Lambda", "region": "us-west-2"},
    "clientes": {"type": "Database", "provider": "aws", "infra": "RDS", "region": "us-east-1"},
    "productos": {"type": "Warehouse", "provider": "gcp", "infra": "GCS", "region": "multi-region"},
    "ventas": {"type": "TransactionManager", "provider": "aws", "infra": "EKS", "region": "eu-central-1"},
    "creditos": {"type": "PaymentProcessor", "provider": "gcp", "infra": "CloudFunctions", "region": "us-central1"},
}

def run_simulation() -> dict:
    db_path = "/opt/cig-node/mock-dbs/erp_v2.db"
    
    try:
        # 1. Connect to SQLite mock DB
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 2. Connect to Neo4j
        driver = GraphDatabase.driver(config.neo4j_uri, auth=(config.neo4j_user, config.neo4j_password))
        
        with driver.session() as session:
            # Clear previous demo data (optional but recommended for a clean start)
            # CAUTION: This is a demo mode only script.
            session.execute_write(lambda tx: tx.run("MATCH (n:Demo) DETACH DELETE n"))
            
            # 3. Create Root Node for Demo
            session.execute_write(lambda tx: tx.run(
                "MERGE (o:Organization:Demo {id: 'demo-corp', name: 'Demo Corp. Production Simulation'})"
            ))

            for table, info in INFRA_MAP.items():
                # Count resources in SQLite
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    count = cursor.fetchone()[0]
                except:
                    count = 0
                
                # Create the Service Node
                service_id = f"service-{table}"
                session.execute_write(lambda tx: tx.run(
                    "MERGE (s:Service:Demo {id: $id, name: $name, type: $type, provider: $provider, data_count: $count}) "
                    "MERGE (o:Organization {id: 'demo-corp'}) "
                    "MERGE (s)-[:OWNED_BY]->(o)",
                    id=service_id, name=table.capitalize(), type=info["type"], provider=info["provider"], count=count
                ))
                
                # Create the Dummy Infra Node
                infra_id = f"infra-{info['infra']}-{table}"
                session.execute_write(lambda tx: tx.run(
                    "MERGE (i:Infra:Demo {id: $id, type: $type, provider: $provider, region: $region}) "
                    "MERGE (s:Service {id: $service_id}) "
                    "MERGE (s)-[:RUNS_ON]->(i)",
                    id=infra_id, type=info["infra"], provider=info["provider"], region=info["region"], service_id=service_id
                ))
            
            # 4. Create some cross-service relationships
            session.execute_write(lambda tx: tx.run(
                "MATCH (s1:Service {id: 'service-ventas'}), (s2:Service {id: 'service-clientes'}) "
                "MERGE (s1)-[:DEPENDS_ON {latency: '5ms'}]->(s2)"
            ))
            session.execute_write(lambda tx: tx.run(
                "MATCH (s1:Service {id: 'service-ventas'}), (s2:Service {id: 'service-vendedores'}) "
                "MERGE (s1)-[:DEPENDS_ON {latency: '12ms'}]->(s2)"
            ))
            session.execute_write(lambda tx: tx.run(
                "MATCH (s1:Service {id: 'service-creditos'}), (s2:Service {id: 'service-ventas'}) "
                "MERGE (s1)-[:PROCESSES]->(s2)"
            ))

        conn.close()
        driver.close()
        
        return {"status": "completed", "note": f"Injected simulation graph from {db_path}"}
        
    except Exception as e:
        logger.exception("Simulation injection failed")
        return {"status": "failed", "error": str(e)}
