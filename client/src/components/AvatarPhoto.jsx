import React, { useEffect, useRef, useState } from "react";
import { UserRoundPlus, CloudUpload, Trash2, LoaderCircle } from "lucide-react";

import { Button } from "./ui/button";
import { Avatar, AvatarImage } from "./ui/avatar";

const AvatarPhoto = ({ image, setImage, currentAvatar, loading }) => {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    if (!image && currentAvatar) {
      setPreview(currentAvatar);
      setFadeIn(true);
    }
  }, [currentAvatar, image]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      setFadeIn(false);
      setTimeout(() => setFadeIn(true), 10);
    }
  };

  const onChooseImage = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center mb-6 border-2 border-dashed border-gray-300 rounded-full">
      <input
        type="file"
        ref={inputRef}
        accept="image/*"
        onChange={handleImageChange}
        className="hidden"
      />

      <div
        className="relative w-24 h-24 flex items-center justify-center cursor-pointer 
          rounded-full hover:bg-gray-50 transition-all duration-300
          hover:scale-105 hover:shadow-xl active:scale-95 group"
        onClick={onChooseImage}
      >
        {preview ? (
          <Avatar className="w-24 h-24">
            <AvatarImage
              src={preview}
              alt="avatar image"
              className={`rounded-full transition-opacity duration-500 ${
                fadeIn ? "opacity-100" : "opacity-0"
              }`}
            />
          </Avatar>
        ) : (
          <>
            <UserRoundPlus className="text-4xl text-primary" />
            <Button size="iconSm" type="button">
              <CloudUpload />
            </Button>
          </>
        )}

        <div
          className="
      absolute inset-0 opacity-0 group-hover:opacity-100
      bg-black/40 rounded-full flex items-center justify-center
      text-white font-semibold text-sm transition
    "
        >
          Change
        </div>

        {loading && (
          <div
            className="
        absolute inset-0 rounded-full bg-black/50 backdrop-blur-sm
        flex items-center justify-center
      "
          >
            <LoaderCircle className="w-10 h-10 text-white animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};

export default AvatarPhoto;
