import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Form, Link } from "@remix-run/react"; // Added Link
import { requireUser } from "~/utils/auth.server";
import { prisma } from "~/utils/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  // Fetch user's enrolled courses and progress
  const userWithCourses = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      image: true,
      courses: {
        include: {
          course: {
            include: {
              chapters: {
                include: {
                  videos: true,
                },
              },
            },
          },
        },
      },
      progress: true,
    },
  });

  if (!userWithCourses) {
     // This should ideally not happen if requireUser succeeds, but as a fallback:
     throw new Response("User not found", { status: 404 });
  }

  // Calculate overall progress and progress per course
  let totalVideos = 0;
  let completedVideos = 0;

  const coursesWithProgress = userWithCourses.courses.map(userCourse => {
    let courseTotalVideos = 0;
    let courseCompletedVideos = 0;

    userCourse.course.chapters.forEach(chapter => {
      courseTotalVideos += chapter.videos.length;
      chapter.videos.forEach(video => {
        const videoProgress = userWithCourses.progress.find(p => p.videoId === video.id);
        if (videoProgress?.completed) {
          courseCompletedVideos++;
        }
      });
    });

    totalVideos += courseTotalVideos;
    completedVideos += courseCompletedVideos;

    const courseProgress = courseTotalVideos > 0 ? (courseCompletedVideos / courseTotalVideos) * 100 : 0;

    return {
      ...userCourse.course,
      progress: courseProgress,
    };
  });


  const overallProgress = totalVideos > 0 ? (completedVideos / totalVideos) * 100 : 0;

  return json({ user: userWithCourses, overallProgress, courses: coursesWithProgress });
}

export default function Dashboard() {
  const { user, overallProgress, courses } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-100 p-8 dark:bg-gray-900">
      <div className="container mx-auto">
        <h1 className="mb-8 text-3xl font-bold text-gray-800 dark:text-white">
          Dashboard
        </h1>

        <div className="mb-8 rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
          <div className="flex items-center space-x-4">
            <img
              src={user.image || "https://www.gravatar.com/avatar/?d=mp&s=128"}
              alt={user.name || "User Avatar"}
              className="h-16 w-16 rounded-full"
            />
            <div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                Welcome, {user.name || "User"}!
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Overall Progress: {overallProgress.toFixed(2)}%
              </p>
            </div>
          </div>
          <div className="mt-4">
             <Form action="/logout" method="post">
                <button
                   type="submit"
                   className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                >
                   Logout
                </button>
             </Form>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="mb-4 text-2xl font-semibold text-gray-800 dark:text-white">
            My Courses
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <div
                key={course.id}
                className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800"
              >
                <h4 className="mb-2 text-xl font-semibold text-blue-600 dark:text-blue-500">
                  {course.title}
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  {course.description}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                   Course Progress: {course.progress.toFixed(2)}%
                </p>
                <div className="mt-4">
                  <Link // Changed from <a> to Link
                    to={`/courses/${course.id}`}
                    className="text-blue-600 hover:underline dark:text-blue-500"
                  >
                    Go to Course
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TODO: Add Profile Section */}
        {/* <div className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
           <h3 className="mb-4 text-2xl font-semibold text-gray-800 dark:text-white">
             Profile
           </h3>
           <p className="text-gray-600 dark:text-gray-400">Name: {user.name}</p>
           <p className="text-gray-600 dark:text-gray-400">Email: {user.email}</p>
           <p className="text-gray-600 dark:text-gray-400">Role: {user.role}</p>
        </div> */}
      </div>
    </div>
  );
}
