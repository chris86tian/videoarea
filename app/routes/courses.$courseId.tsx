import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { prisma } from "~/utils/db.server";
import { requireUser } from "~/utils/auth.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const courseId = params.courseId;

  if (!courseId) {
    throw new Response("Course ID is required", { status: 400 });
  }

  // Fetch the course with its chapters and videos
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      chapters: {
        orderBy: {
          id: "asc", // Or by a specific order field if added
        },
        include: {
          videos: {
            orderBy: {
              order: "asc", // Order videos within a chapter
            },
            include: {
              userProgress: {
                where: { userId: user.id },
              },
            },
          },
        },
      },
    },
  });

  if (!course) {
    throw new Response("Course not found", { status: 404 });
  }

  // Check if the user is enrolled in this course (optional, depending on your model)
  // For now, assuming all authenticated users can view courses.
  // If enrollment is required, you'd check the UserCourse table here.

  return json({ course, user });
}

export default function CourseDetail() {
  const { course, user } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-100 p-8 dark:bg-gray-900">
      <div className="container mx-auto">
        <h1 className="mb-8 text-3xl font-bold text-gray-800 dark:text-white">
          {course.title}
        </h1>
        <p className="mb-8 text-gray-700 dark:text-gray-300">
          {course.description}
        </p>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            {/* Video Player Area - Will be populated when a video is selected */}
            <div className="aspect-video w-full rounded-lg bg-gray-200 dark:bg-gray-700">
              {/* Placeholder for video player */}
              <p className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
                Select a video from the sidebar
              </p>
            </div>
          </div>

          <div className="md:col-span-1">
            <div className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
              <h3 className="mb-4 text-2xl font-semibold text-gray-800 dark:text-white">
                Chapters
              </h3>
              <ul className="space-y-4">
                {course.chapters.map((chapter) => (
                  <li key={chapter.id}>
                    <h4 className="mb-2 text-xl font-semibold text-gray-700 dark:text-gray-300">
                      {chapter.title}
                    </h4>
                    <ul className="space-y-2 pl-4">
                      {chapter.videos.map((video) => {
                        const isCompleted = video.userProgress.some(
                          (p) => p.completed
                        );
                        return (
                          <li key={video.id}>
                            <Link
                              to={`/courses/${course.id}/videos/${video.id}`}
                              className={`flex items-center text-blue-600 hover:underline dark:text-blue-500 ${
                                isCompleted ? "font-semibold text-green-600 dark:text-green-500" : ""
                              }`}
                            >
                              {isCompleted && (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="mr-2 h-5 w-5"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                              {video.title}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
