import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useFetcher } from "@remix-run/react";
import { prisma } from "~/utils/db.server";
import { requireUser } from "~/utils/auth.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const { courseId, videoId } = params;

  if (!courseId || !videoId) {
    throw new Response("Course ID and Video ID are required", { status: 400 });
  }

  // Fetch the specific video and its chapter/course context
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: {
      chapter: {
        include: {
          course: true,
        },
      },
      userProgress: {
        where: { userId: user.id },
      },
    },
  });

  if (!video) {
    throw new Response("Video not found", { status: 404 });
  }

  // Ensure the video belongs to the correct course (optional check)
  if (video.chapter.courseId !== courseId) {
     throw new Response("Video does not belong to this course", { status: 400 });
  }

  // Fetch all chapters and videos for the sidebar (similar to CourseDetail loader)
   const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      chapters: {
        orderBy: {
          id: "asc",
        },
        include: {
          videos: {
            orderBy: {
              order: "asc",
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
      // This should not happen if the video was found, but as a fallback
      throw new Response("Course not found", { status: 404 });
   }


  const isCompleted = video.userProgress.some((p) => p.completed);

  return json({ video, course, isCompleted, user });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const { videoId } = params;

  if (!videoId) {
    return json({ error: "Video ID is required" }, { status: 400 });
  }

  const form = await request.formData();
  const completed = form.get("completed") === "true";

  // Find existing progress or create a new one
  const existingProgress = await prisma.userVideoProgress.findUnique({
    where: {
      userId_videoId: {
        userId: user.id,
        videoId: videoId,
      },
    },
  });

  if (existingProgress) {
    await prisma.userVideoProgress.update({
      where: { id: existingProgress.id },
      data: { completed },
    });
  } else {
    await prisma.userVideoProgress.create({
      data: {
        userId: user.id,
        videoId: videoId,
        completed: completed,
      },
    });
  }

  // Redirect back to the same video page to show updated state
  // Or you could return JSON and update the UI client-side
  return json({ success: true });
}


export default function VideoDetail() {
  const { video, course, isCompleted } = useLoaderData<typeof loader>();
  const fetcher = useFetcher(); // Use fetcher for non-navigation actions

  // Function to extract video ID from URL (basic example)
  const getVideoId = (url: string) => {
    // Basic regex for YouTube and Vimeo
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([\w-]{11})/);
    if (youtubeMatch) return { type: 'youtube', id: youtubeMatch[1] };

    const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/);
     if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1] };

    // Add more cases for S3 or other providers if needed
    return null;
  };

  const videoInfo = getVideoId(video.videoUrl);

  return (
    <div className="min-h-screen bg-gray-100 p-8 dark:bg-gray-900">
      <div className="container mx-auto">
        <h1 className="mb-8 text-3xl font-bold text-gray-800 dark:text-white">
          {course.title}: {video.title}
        </h1>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            {/* Video Player Area */}
            <div className="aspect-video w-full rounded-lg bg-black">
              {videoInfo?.type === 'youtube' && (
                 <iframe
                    className="w-full h-full rounded-lg"
                    src={`https://www.youtube.com/embed/${videoInfo.id}`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={video.title}
                 ></iframe>
              )}
               {videoInfo?.type === 'vimeo' && (
                 <iframe
                    className="w-full h-full rounded-lg"
                    src={`https://player.vimeo.com/video/${videoInfo.id}`}
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title={video.title}
                 ></iframe>
              )}
              {/* Add handling for S3 or other video types */}
               {!videoInfo && (
                 <p className="flex h-full items-center justify-center text-gray-400">
                    Unsupported video URL format.
                 </p>
               )}
            </div>

            <div className="mt-6 flex items-center justify-between rounded-lg bg-white p-4 shadow-md dark:bg-gray-800">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                {video.title}
              </h3>
              <fetcher.Form method="post">
                <input
                  type="hidden"
                  name="completed"
                  value={isCompleted ? "false" : "true"}
                />
                <button
                  type="submit"
                  className={`rounded-md px-4 py-2 text-white ${
                    isCompleted
                      ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                      : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
                  }`}
                >
                  {isCompleted ? "Mark as Unwatched" : "Mark as Watched"}
                </button>
              </fetcher.Form>
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
                      {chapter.videos.map((vid) => {
                         const isVidCompleted = vid.userProgress.some(
                          (p) => p.completed
                        );
                        return (
                          <li key={vid.id}>
                            <Link
                              to={`/courses/${course.id}/videos/${vid.id}`}
                              className={`flex items-center text-blue-600 hover:underline dark:text-blue-500 ${
                                vid.id === video.id ? "font-bold" : ""
                              } ${
                                isVidCompleted ? "font-semibold text-green-600 dark:text-green-500" : ""
                              }`}
                            >
                               {isVidCompleted && (
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
                              {vid.title}
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
