import { useState } from "react";
import { MapPin, Search, Filter, Star, Clock, Phone, Navigation } from "lucide-react";

interface TreatmentCenter {
  id: string;
  name: string;
  address: string;
  city: string;
  distance: string;
  rating: number;
  reviews: number;
  services: string[];
  hours: string;
  phone: string;
  acceptingPatients: boolean;
}

export function TreatmentCenterFinder() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedService, setSelectedService] = useState("all");

  const centers: TreatmentCenter[] = [
    {
      id: "1",
      name: "Downtown Dialysis Center",
      address: "123 Main Street",
      city: "Downtown",
      distance: "2.3 mi",
      rating: 4.8,
      reviews: 124,
      services: ["Hemodialysis", "Peritoneal Dialysis", "Home Training"],
      hours: "Mon-Sat: 6:00 AM - 8:00 PM",
      phone: "(555) 123-4567",
      acceptingPatients: true
    },
    {
      id: "2",
      name: "Northside Medical Facility",
      address: "456 North Avenue",
      city: "Northside",
      distance: "4.1 mi",
      rating: 4.9,
      reviews: 89,
      services: ["Hemodialysis", "Nocturnal Dialysis", "Consultation"],
      hours: "Mon-Fri: 7:00 AM - 7:00 PM",
      phone: "(555) 234-5678",
      acceptingPatients: true
    },
    {
      id: "3",
      name: "Riverside Health Center",
      address: "789 River Road",
      city: "Riverside",
      distance: "5.7 mi",
      rating: 4.7,
      reviews: 156,
      services: ["Hemodialysis", "Peritoneal Dialysis", "Home Hemodialysis"],
      hours: "Daily: 6:00 AM - 10:00 PM",
      phone: "(555) 345-6789",
      acceptingPatients: true
    },
    {
      id: "4",
      name: "Community Care Clinic",
      address: "321 Oak Boulevard",
      city: "Westside",
      distance: "7.2 mi",
      rating: 4.6,
      reviews: 92,
      services: ["Hemodialysis", "Consultation", "Nutritional Counseling"],
      hours: "Mon-Sat: 6:00 AM - 6:00 PM",
      phone: "(555) 456-7890",
      acceptingPatients: false
    },
  ];

  const services = ["all", "Hemodialysis", "Peritoneal Dialysis", "Home Training", "Consultation"];

  const filteredCenters = centers.filter(center => {
    const matchesSearch = center.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         center.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesService = selectedService === "all" || center.services.includes(selectedService);
    return matchesSearch && matchesService;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Treatment Center Finder</h1>
        <p className="text-blue-100">
          Find the best dialysis treatment centers near you
        </p>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by center name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              {services.map(service => (
                <option key={service} value={service}>
                  {service === "all" ? "All Services" : service}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4" />
          <span>Showing {filteredCenters.length} centers near you</span>
        </div>
      </div>

      {/* Centers List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredCenters.map((center) => (
          <div key={center.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">{center.name}</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="font-medium text-gray-900">{center.rating}</span>
                    </div>
                    <span className="text-gray-600 text-sm">({center.reviews} reviews)</span>
                  </div>
                </div>
                {center.acceptingPatients && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    Accepting Patients
                  </span>
                )}
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-start gap-3 text-gray-700">
                  <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p>{center.address}</p>
                    <p className="text-sm text-gray-600">{center.city} • {center.distance} away</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-gray-700">
                  <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <span className="text-sm">{center.hours}</span>
                </div>

                <div className="flex items-center gap-3 text-gray-700">
                  <Phone className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <a href={`tel:${center.phone}`} className="text-sm hover:text-blue-600">
                    {center.phone}
                  </a>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Services Offered:</p>
                <div className="flex flex-wrap gap-2">
                  {center.services.map((service) => (
                    <span
                      key={service}
                      className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Book Here
                </button>
                <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
                  <Navigation className="w-4 h-4" />
                  Directions
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCenters.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Centers Found</h3>
          <p className="text-gray-600">
            Try adjusting your search criteria or filter options
          </p>
        </div>
      )}
    </div>
  );
}
