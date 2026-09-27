CREATE TYPE "InterestedIn" AS ENUM ('men', 'women', 'everyone');

CREATE TYPE "LookingFor" AS ENUM ('dating', 'relationship', 'casual_dating', 'hookup', 'friendship', 'open_to_see_where_it_goes');

ALTER TABLE "Profile"
ADD COLUMN "age" INTEGER,
ADD COLUMN "academicYear" INTEGER,
ADD COLUMN "interestedIn" "InterestedIn",
ADD COLUMN "lookingFor" "LookingFor";