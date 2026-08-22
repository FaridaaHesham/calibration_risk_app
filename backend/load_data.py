import asyncio
import pandas as pd
from sqlalchemy import text
from app.database import engine


async def load_csv(conn, csv_path, table_name, rename_map, columns):
    df = pd.read_csv(csv_path)
    df = df.rename(columns=rename_map)
    df = df[columns]
    df = df.astype(object).where(pd.notnull(df), None)      
    for _, row in df.iterrows():
        cols = ", ".join(row.index)
        placeholders = ", ".join(f":{c}" for c in row.index)
        stmt = text(f"INSERT INTO {table_name} ({cols}) VALUES ({placeholders})")
        await conn.execute(stmt, row.to_dict())


async def main():
    async with engine.begin() as conn:
        await load_csv(
            conn, "devices.csv", "devices",
            rename_map={
                "Serial_number": "serial_number",
                "Model": "model",
                "Manufacturer": "manufacturer",
                "Resolution": "resolution",
            },
            columns=["id", "serial_number", "department_name", "device_type",
                      "model", "manufacturer", "resolution"],
        )
        await load_csv(
            conn, "records.csv", "calibration_records",
            rename_map={},
            columns=["id", "device_id", "calibration_year", "certificate_num",
                      "result", "accessory_type", "accessory_model", "accessory_serial"],
        )
        await load_csv(
            conn, "tests.csv", "calibration_tests",
            rename_map={"MIN_value": "min_value", "MAX_value": "max_value"},
            columns=["id", "calibration_record_id", "test_label", "test_point_unit",
                      "reference_value", "actual_value", "deviation",
                      "min_value", "max_value"],
        )

        for table in ["devices", "calibration_records", "calibration_tests"]:
            await conn.execute(text(
                f"SELECT setval('{table}_id_seq', (SELECT MAX(id) FROM {table}))"
            ))

    print("Data loaded.")

if __name__ == "__main__":
    asyncio.run(main())