import { API } from "../../types";
import { Gif } from "./types";

type Config = {
  tag: string;
  nsfw: boolean;
};

export async function getGif(
  { tag, nsfw }: Config,
  loader: API["loader"],
): Promise<Gif> {
  const tags = tag.split(",").map((t) => t.trim());
  const randomTag = tags[Math.floor(Math.random() * tags.length)];

  const request = new Request(
    "https://api.giphy.com/v1/gifs/random" +
      `?api_key=${GIPHY_API_KEY}` +
      "&rating=" +
      (nsfw ? "r" : "g") +
      (randomTag ? `&tag=${encodeURIComponent(randomTag)}` : ""),
  );

  loader.push();
  
  try {
    const response = await fetch(request);
    
    if (!response.ok) {
      throw new Error(`Giphy API error: ${response.status} ${response.statusText}`);
    }
    
    const res = await response.json();
    
    if (!res.data || !res.data.images || !res.data.images.original) {
      throw new Error('Invalid Giphy API response');
    }
    
    const data = await (await fetch(res.data.images.original.webp)).blob();
    
    return {
      data,
      link: res.data.url,
    };
  } finally {
    loader.pop();
  }
}
