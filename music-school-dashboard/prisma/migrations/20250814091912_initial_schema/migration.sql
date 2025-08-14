-- CreateTable
CREATE TABLE "public"."lesson_notes" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER,
    "lesson_date" TIMESTAMP(3),
    "notes" TEXT,
    "tutor_name" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."students" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "mms_id" TEXT,
    "soundslice_username" TEXT,
    "soundslice_course" TEXT,
    "theta_id" TEXT,
    "parent_email" TEXT,
    "current_tutor" TEXT,
    "instrument" TEXT,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tutors" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "color" TEXT DEFAULT '#3B82F6',

    CONSTRAINT "tutors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sqlite_autoindex_students_1" ON "public"."students"("mms_id");

-- CreateIndex
CREATE UNIQUE INDEX "sqlite_autoindex_tutors_1" ON "public"."tutors"("name");

-- AddForeignKey
ALTER TABLE "public"."lesson_notes" ADD CONSTRAINT "lesson_notes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
