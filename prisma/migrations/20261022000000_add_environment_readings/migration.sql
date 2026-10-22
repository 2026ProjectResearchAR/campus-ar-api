-- CreateEnum
CREATE TYPE "crowd_status" AS ENUM ('crowded', 'moderate', 'vacant');

-- CreateTable
CREATE TABLE "environment_readings" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "co2_ppm" DOUBLE PRECISION NOT NULL,
    "occupancy" INTEGER NOT NULL,
    "status" "crowd_status" NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "environment_readings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "environment_readings_co2_ppm_check" CHECK ("co2_ppm" >= 0),
    CONSTRAINT "environment_readings_occupancy_check" CHECK ("occupancy" >= 0)
);

-- CreateIndex
CREATE INDEX "environment_readings_location_id_recorded_at_idx"
ON "environment_readings"("location_id", "recorded_at");

-- APIのservice role経由でアクセスする。
ALTER TABLE "environment_readings" ENABLE ROW LEVEL SECURITY;
